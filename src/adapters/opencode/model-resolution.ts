import type { AgentRuntimeModelConfig, TeamAgentModelOverride } from "../../core";
import type { ProjectedAgent } from "../../runtime";
import { BUILTIN_CODING_TEAM_ID, BUILTIN_CODING_TEAM_MODEL_FALLBACK } from "../../agent-teams/constants";

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
}

interface ModelCandidate {
  model: string;
  source: ResolvedModelSelection["source"];
  runtime?: AgentRuntimeModelConfig;
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
    fallbackModels: runtime?.fallbackModels,
    fallbackToHostDefault: runtime?.fallbackToHostDefault,
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
    reason: input.reason,
  };
}

function appendConfiguredModelCandidate(input: {
  candidates: ModelCandidate[];
  agentOverride?: TeamAgentModelOverride;
  runtime?: AgentRuntimeModelConfig;
  defaultRuntime?: AgentRuntimeModelConfig;
}): void {
  const runtimeModel = resolveRuntimeModelId(input.runtime);
  const defaultRuntimeModel = resolveRuntimeModelId(input.defaultRuntime);

  if (input.agentOverride?.model) {
    appendUniqueCandidate(input.candidates, {
      model: input.agentOverride.model,
      source: "crewbee-json",
      runtime: applyAgentModelOverride(input.runtime ?? input.defaultRuntime, input.agentOverride),
    });
    return;
  }

  if (runtimeModel) {
    appendUniqueCandidate(input.candidates, {
      model: runtimeModel,
      source: "team-manifest",
      runtime: applyAgentModelOverride(input.runtime, input.agentOverride),
    });
    return;
  }

  if (defaultRuntimeModel) {
    appendUniqueCandidate(input.candidates, {
      model: defaultRuntimeModel,
      source: "team-manifest-default",
      runtime: applyAgentModelOverride(input.defaultRuntime, input.agentOverride),
    });
  }
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
  const candidates: ModelCandidate[] = [];

  appendConfiguredModelCandidate({
    candidates,
    agentOverride,
    runtime: runtimeWithOverride,
    defaultRuntime: defaultRuntimeWithOverride,
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
        reason: "host-default selected explicitly",
      }),
    };
  }

  const sourceAgentId = agent.sourceAgent.metadata.sourceId ?? agent.canonicalAgentId;
  if (fallbackStrategy === BUILTIN_CODING_TEAM_MODEL_FALLBACK && agent.teamId === BUILTIN_CODING_TEAM_ID) {
    for (const model of BUILTIN_ROLE_FALLBACKS[sourceAgentId] ?? BUILTIN_ROLE_FALLBACKS[agent.canonicalAgentId] ?? []) {
      appendUniqueCandidate(candidates, { model, source: "builtin-role-chain", runtime: runtimeWithOverride });
    }
  } else {
    for (const model of runtimeWithOverride?.fallbackModels ?? defaultRuntimeWithOverride?.fallbackModels ?? []) {
      appendUniqueCandidate(candidates, { model, source: "team-manifest", runtime: runtimeWithOverride ?? defaultRuntimeWithOverride });
    }
  }

  const availableModels = input.availableModels ? new Set(input.availableModels) : undefined;
  const skipped: ModelResolutionTrace["skipped"] = [];

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
          reason: "host-default selected from candidate chain",
        }),
      };
    }

    const parsed = parseProviderModel(candidate.model);
    if (!parsed) {
      skipped.push({ model: candidate.model, reason: "model must use provider/model format" });
      continue;
    }

    if (availableModels && !availableModels.has(candidate.model)) {
      skipped.push({ model: candidate.model, reason: "model not available in current OpenCode environment" });
      continue;
    }

    return {
      model: {
        providerID: parsed.providerID,
        modelID: parsed.modelID,
        temperature: candidate.runtime?.temperature,
        topP: candidate.runtime?.topP,
        variant: candidate.runtime?.variant,
        options: candidate.runtime?.options,
        source: candidate.source,
      },
      trace: {
        teamId: agent.teamId,
        agentId: agent.canonicalAgentId,
        configuredModel,
        resolvedModel: candidate.model,
        source: candidate.source,
        fallback: fallbackStrategy,
        fallbackToHostDefault,
        candidates: getCandidateModelIds(candidates),
        skipped,
      },
    };
  }

  return {
    trace: createHostDefaultTrace({
      agent,
      configuredModel,
      fallbackStrategy,
      fallbackToHostDefault,
      candidates,
      skipped,
      reason: fallbackToHostDefault ? "no usable model candidate; fallback_to_host_default enabled" : "no usable model candidate",
    }),
  };
}
