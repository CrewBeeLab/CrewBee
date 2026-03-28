import type { AgentProfileSpec, NormalizedProfileDocument, PromptBlock, PromptValue } from "../core";

import { normalizeValue } from "./normalize-value";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function toSnakeCaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toSnakeCaseValue(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [toSnakeCase(key), toSnakeCaseValue(entry)]),
  );
}

function asMetadataRecord(value: PromptValue | undefined): Record<string, PromptValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("agent.metadata is invalid");
  }

  return value as Record<string, PromptValue>;
}

function pushBlock(blocks: PromptBlock[], key: string, value: unknown, order: number): number {
  const normalized = normalizeValue(toSnakeCaseValue(value));
  if (normalized === undefined) {
    return order;
  }

  blocks.push({
    key,
    path: key,
    value: normalized,
    order,
    source: "generated",
  });

  return order + 1;
}

export function buildAgentPromptSource(agent: AgentProfileSpec): NormalizedProfileDocument {
  return buildAgentPromptSourceWithOverrides(agent, {});
}

export function buildAgentPromptSourceWithOverrides(
  agent: AgentProfileSpec,
  overrides: {
    collaborationValue?: unknown;
  },
): NormalizedProfileDocument {
  const blocks: PromptBlock[] = [];
  let order = 0;

  order = pushBlock(blocks, "persona_core", agent.personaCore, order);
  order = pushBlock(blocks, "responsibility_core", agent.responsibilityCore, order);
  order = pushBlock(blocks, "core_principle", agent.corePrinciple, order);
  order = pushBlock(blocks, "scope_control", agent.scopeControl, order);
  order = pushBlock(blocks, "ambiguity_policy", agent.ambiguityPolicy, order);
  order = pushBlock(blocks, "support_triggers", agent.supportTriggers, order);
  order = pushBlock(blocks, "collaboration", overrides.collaborationValue ?? agent.collaboration, order);
  order = pushBlock(blocks, "repository_assessment", agent.repositoryAssessment, order);
  order = pushBlock(blocks, "task_triage", agent.taskTriage, order);
  order = pushBlock(blocks, "delegation_review", agent.delegationReview, order);
  order = pushBlock(blocks, "todo_discipline", agent.todoDiscipline, order);
  order = pushBlock(blocks, "completion_gate", agent.completionGate, order);
  order = pushBlock(blocks, "failure_recovery", agent.failureRecovery, order);
  order = pushBlock(blocks, "operations", agent.operations, order);
  order = pushBlock(blocks, "output_contract", agent.outputContract, order);
  order = pushBlock(blocks, "templates", agent.templates, order);
  order = pushBlock(blocks, "guardrails", agent.guardrails, order);
  order = pushBlock(blocks, "heuristics", agent.heuristics, order);
  order = pushBlock(blocks, "anti_patterns", agent.antiPatterns, order);
  order = pushBlock(blocks, "tool_skill_strategy", agent.toolSkillStrategy, order);
  order = pushBlock(blocks, "examples", agent.examples, order);

  for (const [key, value] of Object.entries(agent.extraSections ?? {})) {
    order = pushBlock(blocks, key, value, order);
  }

  return {
    kind: "agent",
    metadata: asMetadataRecord(normalizeValue(toSnakeCaseValue(agent.metadata))),
    blocks,
    promptProjection: agent.promptProjection,
  };
}
