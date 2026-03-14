import type { PromptProjectionSpec } from "./core";

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export const TEAM_PROJECTABLE_FIELDS = [
  "mission",
  "governance",
] as const;

export const AGENT_PROJECTABLE_FIELDS = [
  "responsibility_core",
  "persona_core",
  "collaboration",
  "output_contract",
  "operations",
  "templates",
  "guardrails",
  "heuristics",
  "anti_patterns",
  "examples",
  "tool_skill_strategy",
  "entry_point",
  "id",
  "name",
  "owner",
  "tags",
] as const;

export type TeamProjectableField = (typeof TEAM_PROJECTABLE_FIELDS)[number];
export type AgentProjectableField = (typeof AGENT_PROJECTABLE_FIELDS)[number];

function normalizeProjectionList<T extends string>(
  values: readonly string[] | undefined,
  supportedFields: readonly T[],
  label: string,
): T[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const supported = new Set<string>(supportedFields);

  const normalized = unique(
    values
      .map((value) => value.trim())
      .filter(present)
      .map((value) => {
        if (!supported.has(value)) {
          throw new Error(
            `${label} contains non-projectable field '${value}'. Supported fields: ${supportedFields.join(", ")}.`,
          );
        }

        return value;
      }),
  ) as T[];

  return normalized.length > 0 ? normalized : undefined;
}

function normalizePromptProjection<T extends string>(
  spec: PromptProjectionSpec | undefined,
  supportedFields: readonly T[],
  label: string,
): PromptProjectionSpec | undefined {
  if (!spec) {
    return undefined;
  }

  const include = normalizeProjectionList(spec.include, supportedFields, `${label}.include`);
  const exclude = normalizeProjectionList(spec.exclude, supportedFields, `${label}.exclude`);

  if (!include && !exclude) {
    return undefined;
  }

  return { include, exclude };
}

export function normalizeTeamPromptProjection(
  spec: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  return normalizePromptProjection(spec, TEAM_PROJECTABLE_FIELDS, "team.prompt_projection");
}

export function normalizeAgentPromptProjection(
  spec: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  return normalizePromptProjection(spec, AGENT_PROJECTABLE_FIELDS, "agent.prompt_projection");
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
