import type { PromptCatalog, PromptPlan } from "../core";

const CANONICAL_SECTION_TITLES: Record<string, string> = {
  working_rules: "Working Rules",
  approval_safety: "Approval & Safety",
  persona_core: "Persona Core",
  responsibility_core: "Responsibility Core",
  core_principle: "Core Principle",
  scope_control: "Scope Control",
  ambiguity_policy: "Ambiguity Policy",
  support_triggers: "Support Triggers",
  collaboration: "Collaboration",
  task_triage: "Task Triage",
  delegation_review: "Delegation & Review",
  todo_discipline: "Todo Discipline",
  completion_gate: "Completion Gate",
  failure_recovery: "Failure Recovery",
  operations: "Operations",
  output_contract: "Output Contract",
  templates: "Templates",
  guardrails: "Guardrails",
  heuristics: "Heuristics",
  anti_patterns: "Anti Patterns",
  tool_skill_strategy: "Tool Skill Strategy",
};

const AGENT_SECTION_ORDER = [
  "persona_core",
  "responsibility_core",
  "core_principle",
  "scope_control",
  "ambiguity_policy",
  "support_triggers",
  "collaboration",
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

function resolveSectionTitle(path: string, fallback: string): string {
  return CANONICAL_SECTION_TITLES[path] ?? fallback;
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
        title: resolveSectionTitle(node.path, node.label),
        order: index,
        node,
      })),
  };
}
