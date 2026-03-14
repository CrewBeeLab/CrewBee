import type { PromptProjectionSpec } from "./core";

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

const PROJECTABLE_TEAM_FIELDS = new Set<string>([
  "id",
  "kind",
  "version",
  "name",
  "status",
  "owner",
  "description",
  "mission",
  "scope",
  "leader",
  "members",
  "workflow",
  "governance",
  "agent_runtime",
  "tags",
]);

const PROJECTABLE_AGENT_FIELDS = new Set<string>([
  "id",
  "name",
  "owner",
  "tags",
  "persona_core",
  "responsibility_core",
  "collaboration",
  "workflow_override",
  "output_contract",
  "operations",
  "templates",
  "guardrails",
  "heuristics",
  "anti_patterns",
  "examples",
  "entry_point",
]);

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
  workflow: "workflow",
  governance: "governance",
  agent_runtime: "agent_runtime",
  agentRuntime: "agent_runtime",
  tags: "tags",
};

const AGENT_FIELD_ALIASES: Record<string, string> = {
  id: "id",
  name: "name",
  owner: "owner",
  tags: "tags",
  persona_core: "persona_core",
  personaCore: "persona_core",
  responsibility_core: "responsibility_core",
  responsibilityCore: "responsibility_core",
  collaboration: "collaboration",
  workflow_override: "workflow_override",
  workflowOverride: "workflow_override",
  output_contract: "output_contract",
  outputContract: "output_contract",
  operations: "operations",
  templates: "templates",
  guardrails: "guardrails",
  heuristics: "heuristics",
  anti_patterns: "anti_patterns",
  antiPatterns: "anti_patterns",
  examples: "examples",
  entry_point: "entry_point",
  entryPoint: "entry_point",
};

function normalizeProjectionList(
  values: readonly string[] | undefined,
  aliases: Record<string, string>,
  supportedFields: ReadonlySet<string>,
  label: string,
): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = unique(
    values
      .map((value) => value.trim())
      .filter(present)
      .map((value) => {
        const resolved = aliases[value] ?? value;

        if (!supportedFields.has(resolved)) {
          throw new Error(
            `${label} contains non-projectable field '${value}'. Supported fields: ${[...supportedFields].join(", ")}.`,
          );
        }

        return resolved;
      }),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizePromptProjection(
  spec: PromptProjectionSpec | undefined,
  aliases: Record<string, string>,
  supportedFields: ReadonlySet<string>,
  label: string,
): PromptProjectionSpec | undefined {
  if (!spec) {
    return undefined;
  }

  const include = normalizeProjectionList(spec.include, aliases, supportedFields, `${label}.include`);
  const exclude = normalizeProjectionList(spec.exclude, aliases, supportedFields, `${label}.exclude`);

  if (!include && !exclude) {
    return undefined;
  }

  return { include, exclude };
}

export function normalizeTeamPromptProjection(
  spec: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  return normalizePromptProjection(spec, TEAM_FIELD_ALIASES, PROJECTABLE_TEAM_FIELDS, "team.prompt_projection");
}

export function normalizeAgentPromptProjection(
  spec: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  return normalizePromptProjection(spec, AGENT_FIELD_ALIASES, PROJECTABLE_AGENT_FIELDS, "agent.prompt_projection");
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
