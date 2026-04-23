import type { OpenCodeAgentConfigPatch } from "./projection";
import { isManagedCrewBeeAgentDefinition } from "./ownership";

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

export function applyOpenCodeAgentConfigPatch(
  config: OpenCodeConfigLike,
  patch: OpenCodeAgentConfigPatch,
): OpenCodeConfigMergeResult {
  const patchKeys = new Set(Object.keys(patch.agent));
  const nextAgents = Object.fromEntries(
    Object.entries(config.agent ?? {}).filter(([key, definition]) => {
      if (isManagedCrewBeeAgentDefinition(definition) && !patchKeys.has(key)) {
        return false;
      }

      return true;
    }),
  );
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

    if (isManagedCrewBeeAgentDefinition(existingDefinition)) {
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
