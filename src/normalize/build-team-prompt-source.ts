import type {
  NormalizedProfileDocument,
  PromptBlock,
  PromptValue,
  TeamManifest,
  TeamPolicySpec,
} from "../core";

import { normalizeValue } from "./normalize-value";

function asMetadataRecord(value: PromptValue | undefined): Record<string, PromptValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("team.metadata is invalid");
  }

  return value as Record<string, PromptValue>;
}

export function buildTeamPromptSource(
  manifest: Pick<TeamManifest, "id" | "promptProjection"> & { name?: string },
  policy: TeamPolicySpec,
): NormalizedProfileDocument {
  const workingRulesValue = normalizeValue({
    instruction_precedence: policy.instructionPrecedence,
    quality_floor: policy.qualityFloor,
    working_rules: policy.workingRules,
  });

  const approvalSafetyValue = normalizeValue({
    approval_policy: policy.approvalPolicy,
    forbidden_actions: policy.forbiddenActions,
  });

  const blocks: PromptBlock[] = [];

  if (workingRulesValue !== undefined) {
    blocks.push({
      key: "working_rules",
      path: "working_rules",
      value: workingRulesValue,
      order: 0,
      source: "generated",
      title: "Working Rules",
    });
  }

  if (approvalSafetyValue !== undefined) {
    blocks.push({
      key: "approval_safety",
      path: "approval_safety",
      value: approvalSafetyValue,
      order: 1,
      source: "generated",
      title: "Approval & Safety",
    });
  }

  return {
    kind: "team",
    metadata: asMetadataRecord(
      normalizeValue({
        id: manifest.id,
        name: manifest.name,
      }),
    ),
    blocks,
    promptProjection: policy.promptProjection ?? manifest.promptProjection,
  };
}
