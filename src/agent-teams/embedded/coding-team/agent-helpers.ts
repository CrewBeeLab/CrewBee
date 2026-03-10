import type { AgentProfileSpec, CollaborationBindingInput } from "../../../core";

export function createAgent(
  metadata: AgentProfileSpec["metadata"],
  config: Omit<AgentProfileSpec, "metadata">,
): AgentProfileSpec {
  return {
    metadata,
    ...config,
  };
}

export function binding(agentRef: string, description: string): CollaborationBindingInput {
  return {
    agentRef,
    description,
  };
}
