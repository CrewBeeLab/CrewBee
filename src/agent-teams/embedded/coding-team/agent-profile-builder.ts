import type { AgentProfileSpec, CollaborationBindingInput } from "../../../core";

export function createAgentProfile(
  metadata: AgentProfileSpec["metadata"],
  profile: Omit<AgentProfileSpec, "metadata">,
): AgentProfileSpec {
  return {
    metadata,
    ...profile,
  };
}

export function createCollaborationBinding(agentRef: string, description: string): CollaborationBindingInput {
  return {
    agentRef,
    description,
  };
}
