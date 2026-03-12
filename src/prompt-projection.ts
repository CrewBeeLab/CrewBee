import type { PromptProjectionSpec } from "./core";

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

const TEAM_FIELD_ALIASES: Record<string, string> = {
  id: "id",
  kind: "kind",
  version: "version",
  name: "name",
  status: "status",
  owner: "owner",
  description: "description",
  mission: "mission",
  scope: "scope",
  leader: "leader",
  members: "members",
  modes: "modes",
  working_mode: "working_mode",
  workingMode: "working_mode",
  workflow: "workflow",
  implementation_bias: "implementation_bias",
  implementationBias: "implementation_bias",
  ownership_routing: "ownership_routing",
  ownershipRouting: "ownership_routing",
  role_boundaries: "role_boundaries",
  roleBoundaries: "role_boundaries",
  structure_principles: "structure_principles",
  structurePrinciples: "structure_principles",
  governance: "governance",
  agent_runtime: "agent_runtime",
  agentRuntime: "agent_runtime",
  tags: "tags",
  prompt_projection: "prompt_projection",
  promptProjection: "prompt_projection",
};

const AGENT_FIELD_ALIASES: Record<string, string> = {
  id: "id",
  kind: "kind",
  version: "version",
  name: "name",
  status: "status",
  owner: "owner",
  tags: "tags",
  archetype: "archetype",
  persona_core: "persona_core",
  personaCore: "persona_core",
  responsibility_core: "responsibility_core",
  responsibilityCore: "responsibility_core",
  collaboration: "collaboration",
  capabilities: "capabilities",
  workflow_override: "workflow_override",
  workflowOverride: "workflow_override",
  output_contract: "output_contract",
  outputContract: "output_contract",
  ops: "ops",
  operations: "operations",
  templates: "templates",
  guardrails: "guardrails",
  heuristics: "heuristics",
  anti_patterns: "anti_patterns",
  antiPatterns: "anti_patterns",
  examples: "examples",
  entry_point: "entry_point",
  entryPoint: "entry_point",
  prompt_projection: "prompt_projection",
  promptProjection: "prompt_projection",
};

function normalizeProjectionList(
  values: readonly string[] | undefined,
  aliases: Record<string, string>,
): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = unique(
    values
      .map((value) => aliases[value] ?? aliases[value.trim()] ?? value.trim())
      .filter(present),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizePromptProjection(
  spec: PromptProjectionSpec | undefined,
  aliases: Record<string, string>,
): PromptProjectionSpec | undefined {
  if (!spec) {
    return undefined;
  }

  const include = normalizeProjectionList(spec.include, aliases);
  const exclude = normalizeProjectionList(spec.exclude, aliases);

  if (!include && !exclude) {
    return undefined;
  }

  return { include, exclude };
}

export function normalizeTeamPromptProjection(
  spec: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  return normalizePromptProjection(spec, TEAM_FIELD_ALIASES);
}

export function normalizeAgentPromptProjection(
  spec: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  return normalizePromptProjection(spec, AGENT_FIELD_ALIASES);
}

export function shouldProjectField(
  spec: PromptProjectionSpec | undefined,
  field: string,
): boolean {
  if (!spec) {
    return true;
  }

  const include = new Set(spec.include ?? []);
  const exclude = new Set(spec.exclude ?? []);

  if (include.size > 0 && !include.has(field)) {
    return false;
  }

  if (exclude.has(field)) {
    return false;
  }

  return true;
}
