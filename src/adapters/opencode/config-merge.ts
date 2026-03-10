import type { OpenCodeAgentConfigPatch } from "./projection";

export interface OpenCodeConfigLike {
  agent?: Record<string, unknown>;
  default_agent?: string;
}

export interface OpenCodeConfigMergeResult {
  config: OpenCodeConfigLike;
  insertedAgentKeys: string[];
  updatedAgentKeys: string[];
  skippedAgentKeys: string[];
}

function isAgentScrollOwnedKey(key: string): boolean {
  return key.startsWith("agentscroll.");
}

export function applyOpenCodeAgentConfigPatch(
  config: OpenCodeConfigLike,
  patch: OpenCodeAgentConfigPatch,
): OpenCodeConfigMergeResult {
  const nextAgents = { ...(config.agent ?? {}) };
  const insertedAgentKeys: string[] = [];
  const updatedAgentKeys: string[] = [];
  const skippedAgentKeys: string[] = [];

  for (const [key, definition] of Object.entries(patch.agent)) {
    if (!(key in nextAgents)) {
      nextAgents[key] = definition;
      insertedAgentKeys.push(key);
      continue;
    }

    if (isAgentScrollOwnedKey(key)) {
      nextAgents[key] = definition;
      updatedAgentKeys.push(key);
      continue;
    }

    skippedAgentKeys.push(key);
  }

  const nextConfig: OpenCodeConfigLike = {
    ...config,
    agent: nextAgents,
  };

  if (patch.defaultAgent && (!config.default_agent || isAgentScrollOwnedKey(config.default_agent))) {
    nextConfig.default_agent = patch.defaultAgent;
  }

  return {
    config: nextConfig,
    insertedAgentKeys,
    updatedAgentKeys,
    skippedAgentKeys,
  };
}
