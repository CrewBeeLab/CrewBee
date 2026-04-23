import type { OpenCodeAgentConfigPatch, OpenCodeAgentDefinition } from "./projection";

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

const CURRENT_PLUGIN_KEY_PREFIX = "crewbee.";
const LEGACY_PLUGIN_KEY_PREFIX = "agentscroll.";

function isLegacyCrewBeeOwnedKey(key: string): boolean {
  return key.startsWith(LEGACY_PLUGIN_KEY_PREFIX);
}

function isCrewBeeOwnedKey(key: string): boolean {
  return key.startsWith(CURRENT_PLUGIN_KEY_PREFIX);
}

function isCompatibleCrewBeeOwnedKey(key: string): boolean {
  return isCrewBeeOwnedKey(key) || isLegacyCrewBeeOwnedKey(key);
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

    const existingDefinition = nextAgents[key];

    if (isCompatibleCrewBeeOwnedKey(key)) {
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

  if (patch.defaultAgent) {
    nextConfig.default_agent = patch.defaultAgent;
  }

  return {
    config: nextConfig,
    insertedAgentKeys,
    updatedAgentKeys,
    skippedAgentKeys,
  };
}
