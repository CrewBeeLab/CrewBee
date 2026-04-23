import type { OpenCodeAgentConfig } from "../projection";

import type { DelegateCheckpoint, DelegatePromptModel } from "./types";

function truncatePrompt(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
}

export function createDelegatedTitle(agent: string, prompt: string): string {
  return `${agent}: ${truncatePrompt(prompt)}`;
}

export function resolveDelegateModel(target: OpenCodeAgentConfig, fallback?: DelegatePromptModel): DelegatePromptModel | undefined {
  if (target.resolvedModel) {
    return {
      providerID: target.resolvedModel.providerID,
      modelID: target.resolvedModel.modelID,
    };
  }

  return fallback;
}

export function createDelegationEnvelope(input: {
  agent: string;
  parentSessionID: string;
  sessionID: string;
  prompt: string;
}): string {
  return [
    `You are continuing work as CrewBee team member: ${input.agent}.`,
    "",
    `Parent session: ${input.parentSessionID}`,
    `Delegated session: ${input.sessionID}`,
    "",
    "Your delegated objective:",
    input.prompt.trim(),
    "",
    "Execution rules:",
    "- Work only on this delegated objective",
    "- Do not broaden scope",
    "- If you need a skill, decide and load it yourself based on the task",
    "- Prefer a compact result focused on outcome, files changed, blockers, and next step",
    "",
    "Return:",
    "1. Result / conclusion",
    "2. Files changed or inspected",
    "3. Remaining risk or blocker",
    "4. Recommended next step",
  ].join("\n");
}

export function createCheckpoint(agent: OpenCodeAgentConfig, model?: DelegatePromptModel): DelegateCheckpoint {
  return {
    agent: agent.configKey,
    model,
    tools: [...agent.runtimeConfig.requestedTools],
  };
}
