import type { SessionRuntimeBinding } from "../../../runtime";
import type { OpenCodeAgentAliasEntry, OpenCodeAgentConfig } from "../projection";
import {
  resolveProjectedAgentAlias,
  resolveProjectedAgentSelection,
} from "../projection";

import type { ResolvedDelegateAgent } from "./types";

function findBySourceAgentId(agents: OpenCodeAgentConfig[], agent: string): OpenCodeAgentConfig | undefined {
  return agents.find((item) => item.sourceAgentId === agent);
}

export function resolveDelegateAgent(input: {
  agents: OpenCodeAgentConfig[];
  aliasIndex: Map<string, OpenCodeAgentAliasEntry>;
  agent: string;
}): ResolvedDelegateAgent | undefined {
  const bySource = findBySourceAgentId(input.agents, input.agent);
  if (bySource) {
    return {
      agent: bySource,
      configKey: bySource.configKey,
      sourceAgentId: bySource.sourceAgentId,
    };
  }

  const bySelection = resolveProjectedAgentSelection(input.agents, {
    configKey: input.agent,
    publicName: input.agent,
  });
  if (bySelection) {
    return {
      agent: bySelection,
      configKey: bySelection.configKey,
      sourceAgentId: bySelection.sourceAgentId,
    };
  }

  const byAlias = resolveProjectedAgentAlias(input.aliasIndex, input.agent);
  if (!byAlias) {
    return undefined;
  }

  return {
    agent: byAlias.agent,
    configKey: byAlias.agent.configKey,
    sourceAgentId: byAlias.agent.sourceAgentId,
  };
}

export function isSelfDelegate(binding: SessionRuntimeBinding | undefined, sourceAgentId: string): boolean {
  if (!binding) {
    return false;
  }

  return binding.selectedAgentId === sourceAgentId;
}
