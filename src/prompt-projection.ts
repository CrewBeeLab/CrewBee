import type { PromptProjectionSpec } from "./core";

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export const TEAM_PROJECTABLE_FIELDS = ["mission", "governance"] as const;

export const AGENT_PROJECTABLE_FIELDS = [
  "persona_core",
  "responsibility_core",
  "responsibility_core.description",
  "responsibility_core.objective",
  "responsibility_core.authority",
  "responsibility_core.output_preference",
  "responsibility_core.use_when",
  "responsibility_core.avoid_when",
  "responsibility_core.success_definition",
  "responsibility_core.non_goals",
  "responsibility_core.in_scope",
  "responsibility_core.out_of_scope",
  "execution_policy",
  "execution_policy.core_principle",
  "execution_policy.ambiguity_policy",
  "execution_policy.support_triggers",
  "execution_policy.repository_assessment",
  "execution_policy.task_triage",
  "execution_policy.delegation_policy",
  "execution_policy.review_policy",
  "execution_policy.todo_discipline",
  "execution_policy.completion_gate",
  "execution_policy.failure_recovery",
  "collaboration",
  "output_contract",
  "operations",
  "operations.autonomy_level",
  "operations.stop_conditions",
  "operations.core_operation_skeleton",
  "templates",
  "templates.exploration_checklist",
  "templates.execution_plan",
  "templates.final_report",
  "guardrails",
  "guardrails.critical",
  "heuristics",
  "anti_patterns",
  "examples",
  "examples.fit",
  "examples.fit.good_fit",
  "examples.fit.bad_fit",
  "examples.micro",
  "examples.micro.ambiguity_resolution",
  "examples.micro.final_closure",
  "tool_skill_strategy",
  "tool_skill_strategy.principles",
  "tool_skill_strategy.preferred_order",
  "tool_skill_strategy.avoid",
  "tool_skill_strategy.notes",
  "entry_point",
  "id",
  "name",
  "owner",
  "tags",
  "archetype",
  "runtime_config",
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

function matchesProjectionPath(selectedPath: string, field: string): boolean {
  return selectedPath === field || field.startsWith(`${selectedPath}.`);
}

export function shouldProjectField(
  spec: PromptProjectionSpec | undefined,
  field: string,
): boolean {
  if (!spec) {
    return true;
  }

  const include = spec.include ?? [];
  const exclude = spec.exclude ?? [];

  if (include.length > 0 && !include.some((selectedPath) => matchesProjectionPath(selectedPath, field))) {
    return false;
  }

  if (exclude.some((selectedPath) => matchesProjectionPath(selectedPath, field))) {
    return false;
  }

  return true;
}
