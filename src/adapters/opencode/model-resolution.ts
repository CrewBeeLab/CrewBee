import type { AgentRuntimeModelConfig, TeamAgentModelOverride } from "../../core";
import type { ProjectedAgent } from "../../runtime";
import { BUILTIN_CODING_TEAM_AGENT_MODELS, BUILTIN_CODING_TEAM_ID, BUILTIN_CODING_TEAM_MODEL_FALLBACK } from "../../agent-teams/constants";

export interface ModelResolutionTrace {
  teamId: string;
  agentId: string;
  configuredModel?: string;
  resolvedModel: string | "host-default";
  source: "crewbee-json" | "team-manifest" | "team-manifest-default" | "builtin-role-chain" | "host-default";
  fallback: string;
  fallbackToHostDefault: boolean;
  candidates: string[];
  skipped: Array<{ model: string; reason: string }>;
  availability: "checked" | "unavailable";
  strict?: boolean;
  reason?: string;
}

export interface ResolvedModelSelection {
  providerID: string;
  modelID: string;
  temperature?: number;
  topP?: number;
  variant?: string;
  options?: Record<string, unknown>;
  source: "crewbee-json" | "team-manifest" | "team-manifest-default" | "builtin-role-chain";
  strict?: boolean;
}

interface ModelCandidate {
  model: string;
  source: ResolvedModelSelection["source"];
  runtime?: AgentRuntimeModelConfig;
  strict?: boolean;
  allowWhenAvailabilityUnknown?: boolean;
}

const HOST_DEFAULT_MODEL_ID = "host-default";
const TEAM_MANIFEST_FALLBACK_STRATEGY = "team-manifest";

const BUILTIN_ROLE_FALLBACKS: Record<string, string[]> = {
  "coding-leader": ["openai/gpt-5.5-pro", "anthropic/claude-opus-4-7", "google/gemini-3.1-pro-preview"],
  "coordination-leader": ["anthropic/claude-opus-4-7", "google/gemini-3.1-pro-preview", "openai/gpt-5.4-mini"],
  "coding-executor": ["openai/gpt-5.5-pro", "anthropic/claude-opus-4-7", "google/gemini-3.1-pro-preview"],
  "codebase-explorer": ["google/gemini-3.1-flash-lite-preview", "openai/gpt-5.5", "google/gemini-3.1-pro-preview"],
  "web-researcher": ["openai/gpt-5.5", "anthropic/claude-opus-4-7", "google/gemini-3.1-flash-lite-preview"],
  reviewer: ["openai/gpt-5.5-pro", "openai/gpt-5.5", "google/gemini-3.1-pro-preview"],
  "principal-advisor": ["openai/gpt-5.5-pro", "openai/gpt-5.5", "google/gemini-3.1-pro-preview"],
  "multimodal-looker": ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
  "task-orchestrator": ["anthropic/claude-opus-4-7", "google/gemini-3.1-pro-preview", "openai/gpt-5.4-mini"],
};

function resolveRuntimeModelId(runtime: AgentRuntimeModelConfig | undefined): string | undefined {
  if (!runtime?.model) {
    return undefined;
  }

  if (runtime.model === HOST_DEFAULT_MODEL_ID || runtime.model.includes("/")) {
    return runtime.model;
  }

  return runtime.provider ? `${runtime.provider}/${runtime.model}` : runtime.model;
}

function mergeModelOptions(
  baseOptions: Record<string, unknown> | undefined,
  overrideOptions: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const merged = {
    ...(baseOptions ?? {}),
    ...(overrideOptions ?? {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function applyAgentModelOverride(
  runtime: AgentRuntimeModelConfig | undefined,
  override: TeamAgentModelOverride | undefined,
): AgentRuntimeModelConfig | undefined {
  if (!override) {
    return runtime;
  }

  const model = override.model ?? runtime?.model;
  if (!model) {
    return runtime;
  }

  return {
    provider: runtime?.provider,
    model,
    temperature: runtime?.temperature,
    topP: runtime?.topP,
    variant: override.variant ?? runtime?.variant,
    options: mergeModelOptions(runtime?.options, override.options),
    fallbackModels: override.fallbackModels ?? runtime?.fallbackModels,
    fallbackToHostDefault: runtime?.fallbackToHostDefault,
    strict: override.strict ?? runtime?.strict,
  };
}

function parseProviderModel(model: string): { providerID: string; modelID: string } | undefined {
  const separator = model.indexOf("/");
  if (separator <= 0 || separator >= model.length - 1) {
    return undefined;
  }

  return {
    providerID: model.slice(0, separator),
    modelID: model.slice(separator + 1),
  };
}

function appendUniqueCandidate(candidates: ModelCandidate[], candidate: ModelCandidate): void {
  if (candidates.some((entry) => entry.model === candidate.model)) {
    return;
  }

  candidates.push(candidate);
}

function getCandidateModelIds(candidates: readonly ModelCandidate[]): string[] {
  return candidates.map((candidate) => candidate.model);
}

function createHostDefaultTrace(input: {
  agent: ProjectedAgent;
  configuredModel?: string;
  fallbackStrategy: string;
  fallbackToHostDefault: boolean;
  candidates: readonly ModelCandidate[];
  skipped: ModelResolutionTrace["skipped"];
  availability: ModelResolutionTrace["availability"];
  reason: string;
}): ModelResolutionTrace {
  return {
    teamId: input.agent.teamId,
    agentId: input.agent.canonicalAgentId,
    configuredModel: input.configuredModel,
    resolvedModel: HOST_DEFAULT_MODEL_ID,
    source: "host-default",
    fallback: input.fallbackStrategy,
    fallbackToHostDefault: input.fallbackToHostDefault,
    candidates: getCandidateModelIds(input.candidates),
    skipped: input.skipped,
    availability: input.availability,
    reason: input.reason,
  };
}

function isBuiltinCodingTeamDefaultModel(input: {
  agent: ProjectedAgent;
  model: string;
}): boolean {
  if (input.agent.teamId !== BUILTIN_CODING_TEAM_ID) {
    return false;
  }

  const sourceAgentId = input.agent.sourceAgent.metadata.sourceId ?? input.agent.canonicalAgentId;
  if (BUILTIN_CODING_TEAM_AGENT_MODELS[sourceAgentId] === input.model || BUILTIN_CODING_TEAM_AGENT_MODELS[input.agent.canonicalAgentId] === input.model) {
    return true;
  }

  return BUILTIN_ROLE_FALLBACKS[sourceAgentId]?.includes(input.model) === true
    || BUILTIN_ROLE_FALLBACKS[input.agent.canonicalAgentId]?.includes(input.model) === true;
}

function appendConfiguredModelCandidate(input: {
  candidates: ModelCandidate[];
  agentOverride?: TeamAgentModelOverride;
  runtime?: AgentRuntimeModelConfig;
  defaultRuntime?: AgentRuntimeModelConfig;
  allowWhenAvailabilityUnknown?: boolean;
}): void {
  const runtimeModel = resolveRuntimeModelId(input.runtime);
  const defaultRuntimeModel = resolveRuntimeModelId(input.defaultRuntime);

  if (input.agentOverride?.model) {
    appendUniqueCandidate(input.candidates, {
      model: input.agentOverride.model,
      source: "crewbee-json",
      runtime: applyAgentModelOverride(input.runtime ?? input.defaultRuntime, input.agentOverride),
      strict: input.agentOverride.strict === true,
      allowWhenAvailabilityUnknown: input.allowWhenAvailabilityUnknown ?? true,
    });
    return;
  }

  if (runtimeModel) {
    appendUniqueCandidate(input.candidates, {
      model: runtimeModel,
      source: "team-manifest",
      runtime: applyAgentModelOverride(input.runtime, input.agentOverride),
      strict: input.runtime?.strict === true,
      allowWhenAvailabilityUnknown: input.runtime?.strict === true,
    });
    return;
  }

  if (defaultRuntimeModel) {
    appendUniqueCandidate(input.candidates, {
      model: defaultRuntimeModel,
      source: "team-manifest-default",
      runtime: applyAgentModelOverride(input.defaultRuntime, input.agentOverride),
      strict: input.defaultRuntime?.strict === true,
      allowWhenAvailabilityUnknown: input.defaultRuntime?.strict === true,
    });
  }
}

function createResolvedModel(input: {
  agent: ProjectedAgent;
  candidate: ModelCandidate;
  parsed: { providerID: string; modelID: string };
  configuredModel?: string;
  fallbackStrategy: string;
  fallbackToHostDefault: boolean;
  candidates: ModelCandidate[];
  skipped: ModelResolutionTrace["skipped"];
  availability: ModelResolutionTrace["availability"];
  reason?: string;
}): { model: ResolvedModelSelection; trace: ModelResolutionTrace } {
  return {
    model: {
      providerID: input.parsed.providerID,
      modelID: input.parsed.modelID,
      temperature: input.candidate.runtime?.temperature,
      topP: input.candidate.runtime?.topP,
      variant: input.candidate.runtime?.variant,
      options: input.candidate.runtime?.options,
      source: input.candidate.source,
      strict: input.candidate.strict === true,
    },
    trace: {
      teamId: input.agent.teamId,
      agentId: input.agent.canonicalAgentId,
      configuredModel: input.configuredModel,
      resolvedModel: input.candidate.model,
      source: input.candidate.source,
      fallback: input.fallbackStrategy,
      fallbackToHostDefault: input.fallbackToHostDefault,
      candidates: getCandidateModelIds(input.candidates),
      skipped: input.skipped,
      availability: input.availability,
      strict: input.candidate.strict === true,
      reason: input.reason,
    },
  };
}

export function resolveAgentModel(input: {
  agent: ProjectedAgent;
  availableModels?: readonly string[];
}): { model?: ResolvedModelSelection; trace: ModelResolutionTrace } {
  const { agent } = input;
  const teamOverride = agent.sourceTeam.modelConfigOverride;
  const agentOverride = teamOverride?.agents?.[agent.canonicalAgentId];
  const runtime = agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId];
  const defaultRuntime = agent.sourceTeam.manifest.agentRuntime?.$default;
  const runtimeWithOverride = applyAgentModelOverride(runtime, agentOverride);
  const defaultRuntimeWithOverride = applyAgentModelOverride(defaultRuntime, agentOverride);
  const fallbackStrategy = teamOverride?.fallback
    ?? (agent.teamId === BUILTIN_CODING_TEAM_ID ? BUILTIN_CODING_TEAM_MODEL_FALLBACK : TEAM_MANIFEST_FALLBACK_STRATEGY);
  const fallbackToHostDefault = teamOverride?.fallbackToHostDefault
    ?? runtime?.fallbackToHostDefault
    ?? defaultRuntime?.fallbackToHostDefault
    ?? true;
  const runtimeModel = resolveRuntimeModelId(runtime);
  const configuredModel = agentOverride?.model ?? runtimeModel ?? resolveRuntimeModelId(defaultRuntime);
  const configuredIsBuiltinDefault = configuredModel
    ? isBuiltinCodingTeamDefaultModel({ agent, model: configuredModel })
    : false;
  const candidates: ModelCandidate[] = [];
  const availableModels = input.availableModels ? new Set(input.availableModels) : undefined;
  const availability: ModelResolutionTrace["availability"] = availableModels ? "checked" : "unavailable";
  const skipped: ModelResolutionTrace["skipped"] = [];

  appendConfiguredModelCandidate({
    candidates,
    agentOverride,
    runtime: runtimeWithOverride,
    defaultRuntime: defaultRuntimeWithOverride,
    allowWhenAvailabilityUnknown: !configuredIsBuiltinDefault,
  });

  if (agentOverride?.model === HOST_DEFAULT_MODEL_ID || (!agentOverride?.model && runtimeModel === HOST_DEFAULT_MODEL_ID)) {
    return {
      trace: createHostDefaultTrace({
        agent,
        configuredModel,
        fallbackStrategy,
        fallbackToHostDefault,
        candidates,
        skipped: [],
        availability,
        reason: "host-default selected explicitly",
      }),
    };
  }

  const sourceAgentId = agent.sourceAgent.metadata.sourceId ?? agent.canonicalAgentId;
  if (fallbackStrategy === BUILTIN_CODING_TEAM_MODEL_FALLBACK && agent.teamId === BUILTIN_CODING_TEAM_ID) {
    for (const model of BUILTIN_ROLE_FALLBACKS[sourceAgentId] ?? BUILTIN_ROLE_FALLBACKS[agent.canonicalAgentId] ?? []) {
      appendUniqueCandidate(candidates, { model, source: "builtin-role-chain", runtime: runtimeWithOverride, allowWhenAvailabilityUnknown: false });
    }
  } else {
    for (const model of runtimeWithOverride?.fallbackModels ?? defaultRuntimeWithOverride?.fallbackModels ?? []) {
      const fallbackRuntime = runtimeWithOverride ?? defaultRuntimeWithOverride;
      appendUniqueCandidate(candidates, {
        model,
        source: "team-manifest",
        runtime: fallbackRuntime,
        strict: fallbackRuntime?.strict === true,
        allowWhenAvailabilityUnknown: fallbackRuntime?.strict === true,
      });
    }
  }

  for (const candidate of candidates) {
    if (candidate.model === HOST_DEFAULT_MODEL_ID) {
      return {
        trace: createHostDefaultTrace({
          agent,
          configuredModel,
          fallbackStrategy,
          fallbackToHostDefault,
          candidates,
          skipped,
          availability,
          reason: "host-default selected from candidate chain",
        }),
      };
    }

    const parsed = parseProviderModel(candidate.model);
    if (!parsed) {
      skipped.push({ model: candidate.model, reason: "model must use provider/model format" });
      continue;
    }

    if (candidate.strict) {
      return createResolvedModel({
        agent,
        candidate,
        parsed,
        configuredModel,
        fallbackStrategy,
        fallbackToHostDefault,
        candidates,
        skipped,
        availability,
        reason: availableModels && !availableModels.has(candidate.model)
          ? "strict model selected; availability check bypassed"
          : undefined,
      });
    }

    if (!availableModels && !candidate.allowWhenAvailabilityUnknown) {
      skipped.push({ model: candidate.model, reason: "availability registry unavailable; candidate is not strict user configuration" });
      continue;
    }

    if (availableModels && !availableModels.has(candidate.model)) {
      skipped.push({ model: candidate.model, reason: "model not available in current OpenCode environment" });
      continue;
    }

    return createResolvedModel({
      agent,
      candidate,
      parsed,
      configuredModel,
      fallbackStrategy,
      fallbackToHostDefault,
      candidates,
      skipped,
      availability,
    });
  }

  return {
    trace: createHostDefaultTrace({
      agent,
      configuredModel,
      fallbackStrategy,
      fallbackToHostDefault,
      candidates,
      skipped,
      availability,
      reason: fallbackToHostDefault ? "no usable model candidate; fallback_to_host_default enabled" : "no usable model candidate",
    }),
  };
}
