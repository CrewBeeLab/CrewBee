import type { PromptCatalog, PromptPlan } from "../core";

const AGENT_SECTION_ORDER = [
  "persona_core",
  "responsibility_core",
  "core_principle",
  "scope_control",
  "ambiguity_policy",
  "support_triggers",
  "collaboration",
  "repository_assessment",
  "task_triage",
  "delegation_review",
  "todo_discipline",
  "completion_gate",
  "failure_recovery",
  "operations",
  "output_contract",
  "templates",
  "guardrails",
  "heuristics",
  "anti_patterns",
  "tool_skill_strategy",
] as const;

const TEAM_SECTION_ORDER = ["working_rules", "approval_safety"] as const;

function sectionRank(kind: "team" | "agent", path: string): number {
  const list: readonly string[] = kind === "team" ? TEAM_SECTION_ORDER : AGENT_SECTION_ORDER;
  const index = list.indexOf(path);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function buildPromptPlan(catalog: PromptCatalog): PromptPlan {
  return {
    sections: [...catalog.nodes]
      .sort((left, right) => {
        const rankDiff = sectionRank(catalog.kind, left.path) - sectionRank(catalog.kind, right.path);
        if (rankDiff !== 0) {
          return rankDiff;
        }

        return left.order - right.order;
      })
      .map((node, index) => ({
        path: node.path,
        title: node.label,
        order: index,
        node,
      })),
  };
}
