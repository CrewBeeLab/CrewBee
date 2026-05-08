import type { SessionRuntimeBinding } from "../../../runtime";
import type { OpenCodeAgentAliasEntry, OpenCodeAgentConfig } from "../projection";
import {
  resolveProjectedAgentAlias,
  resolveProjectedAgentSelection,
} from "../projection";

import type { ResolvedDelegateAgent } from "./types";

export function resolveDelegateAgent(input: {
  agents: OpenCodeAgentConfig[];
  aliasIndex: Map<string, OpenCodeAgentAliasEntry>;
  agent: string;
  sourceAgent?: OpenCodeAgentConfig;
}): ResolvedDelegateAgent | undefined {
  const bySelection = resolveProjectedAgentSelection(input.agents, {
    configKey: input.agent,
  });
  if (bySelection && isAllowedDelegateTarget(input.sourceAgent, bySelection)) {
    return {
      agent: bySelection,
      configKey: bySelection.configKey,
      canonicalAgentId: bySelection.canonicalAgentId,
    };
  }

  const byAlias = resolveProjectedAgentAlias(input.aliasIndex, input.agent);
  if (!byAlias || !isAllowedDelegateTarget(input.sourceAgent, byAlias.agent)) {
    return undefined;
  }

  return {
    agent: byAlias.agent,
    configKey: byAlias.agent.configKey,
    canonicalAgentId: byAlias.agent.canonicalAgentId,
  };
}

function isAllowedDelegateTarget(sourceAgent: OpenCodeAgentConfig | undefined, targetAgent: OpenCodeAgentConfig): boolean {
  if (!sourceAgent) {
    return false;
  }

  return sourceAgent.delegation.allowedTargets.some((target) => target.configKey === targetAgent.configKey);
}

export function isSelfDelegate(binding: SessionRuntimeBinding | undefined, canonicalAgentId: string): boolean {
  if (!binding) {
    return false;
  }

  return binding.selectedAgentId === canonicalAgentId;
}
