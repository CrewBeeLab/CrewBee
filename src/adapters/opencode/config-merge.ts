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

function getConfiguredAgentName(definition: unknown): string | undefined {
  if (typeof definition !== "object" || definition === null || !("name" in definition)) {
    return undefined;
  }

  const candidate = definition.name;
  return typeof candidate === "string" ? candidate : undefined;
}

export function applyOpenCodeAgentConfigPatch(
  config: OpenCodeConfigLike,
  patch: OpenCodeAgentConfigPatch,
): OpenCodeConfigMergeResult {
  const nextAgents = { ...(config.agent ?? {}) };
  const insertedAgentKeys: string[] = [];
  const updatedAgentKeys: string[] = [];
  const skippedAgentKeys: string[] = [];
  const nextPublicNames = new Set(
    Object.values(patch.agent)
      .map((definition) => definition.name)
      .filter((name): name is string => Boolean(name)),
  );

  for (const [key, definition] of Object.entries(nextAgents)) {
    const publicName = getConfiguredAgentName(definition);
    if (publicName && isLegacyCrewBeeOwnedKey(key) && nextPublicNames.has(publicName)) {
      delete nextAgents[key];
    }
  }

  for (const [key, definition] of Object.entries(patch.agent)) {
    if (!(key in nextAgents)) {
      nextAgents[key] = definition;
      insertedAgentKeys.push(key);
      continue;
    }

    if (isCrewBeeOwnedKey(key)) {
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

  if (patch.defaultAgent && (!config.default_agent || isCompatibleCrewBeeOwnedKey(config.default_agent))) {
    nextConfig.default_agent = patch.defaultAgent;
  }

  return {
    config: nextConfig,
    insertedAgentKeys,
    updatedAgentKeys,
    skippedAgentKeys,
  };
}
