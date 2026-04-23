import { createSessionRuntimeBinding, type SessionRuntimeBinding } from "../../runtime";

import { createCheckpoint } from "./delegation/prompt";
import type { DelegateStateStore } from "./delegation/store";
import type { OpenCodeBootstrapOutput } from "./bootstrap";
import { resolveProjectedAgentSelection } from "./projection";

function getDefaultAgent(boot: OpenCodeBootstrapOutput): string | undefined {
  return boot.mergedConfig?.default_agent ?? boot.configPatch.defaultAgent;
}

function resolveModel(agent: OpenCodeBootstrapOutput["projectedAgents"][number], model?: { providerID: string; modelID: string }) {
  if (model) {
    return model;
  }

  if (!agent.resolvedModel) {
    return undefined;
  }

  return {
    providerID: agent.resolvedModel.providerID,
    modelID: agent.resolvedModel.modelID,
  };
}

export function createChatMessageHook(input: {
  bindings: Map<string, SessionRuntimeBinding>;
  store: DelegateStateStore;
  getBoot(): OpenCodeBootstrapOutput;
}) {
  return async (
    message: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string } },
    _output: { message: unknown; parts: unknown[] },
  ) => {
    const boot = input.getBoot();
    const selected = message.agent ?? getDefaultAgent(boot);
    if (!selected) {
      return;
    }

    const agent = resolveProjectedAgentSelection(boot.projectedAgents, {
      configKey: selected,
    });
    if (!agent) {
      return;
    }

    const binding = createSessionRuntimeBinding({
      projection: boot.projection,
      sessionID: message.sessionID,
      teamId: agent.teamId,
      canonicalAgentId: agent.canonicalAgentId,
      mode: "single-executor",
      source: message.agent ? "host-agent-selection" : "plugin-default",
    });
    input.bindings.set(message.sessionID, binding);
    input.store.setCheckpoint(message.sessionID, createCheckpoint(agent, resolveModel(agent, message.model)));
  };
}
