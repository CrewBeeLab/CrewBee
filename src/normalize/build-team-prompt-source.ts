import type {
  LoadedBodySection,
  NormalizedProfileDocument,
  PromptBlock,
  PromptValue,
  TeamManifest,
  TeamPolicySpec,
} from "../core";

import { normalizeMarkdownSection, normalizeValue } from "./normalize-value";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : undefined;
}

function asMetadataRecord(value: PromptValue | undefined): Record<string, PromptValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("team.metadata is invalid");
  }

  return value as Record<string, PromptValue>;
}

export function buildTeamPromptSource(
  manifest: Pick<TeamManifest, "id" | "promptProjection"> & { name?: string },
  policy: TeamPolicySpec,
  bodySections: LoadedBodySection[] = [],
): NormalizedProfileDocument {
  const qualityFloor = asRecord(policy.qualityFloor);
  const approvalPolicy = asRecord(policy.approvalPolicy);

  const workingRulesValue = normalizeValue({
    instruction_precedence: policy.instructionPrecedence,
    quality_floor: {
      required_checks: qualityFloor?.required_checks ?? qualityFloor?.requiredChecks,
      evidence_required: qualityFloor?.evidence_required ?? qualityFloor?.evidenceRequired,
    },
    working_rules: policy.workingRules,
  });

  const approvalSafetyValue = normalizeValue({
    approval_required_for: approvalPolicy?.required_for ?? approvalPolicy?.requiredFor,
    allow_assume_for: approvalPolicy?.allow_assume_for ?? approvalPolicy?.allowAssumeFor,
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

  let nextOrder = blocks.length;
  for (const section of bodySections) {
    const normalized = normalizeMarkdownSection(section.rawMarkdown);
    if (normalized === undefined) {
      continue;
    }

    blocks.push({
      key: section.key,
      path: section.key,
      value: normalized,
      order: nextOrder,
      source: "body",
      title: section.title,
    });
    nextOrder += 1;
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
