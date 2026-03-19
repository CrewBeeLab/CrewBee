import type { SessionRuntimeBinding } from "../../runtime";

export function createSystemTransformHook(bindings: Map<string, SessionRuntimeBinding>) {
  return async (input: { sessionID?: string; model: unknown }, output: { system: string[] }) => {
    if (!input.sessionID) {
      return;
    }

    const binding = bindings.get(input.sessionID);
    if (!binding) {
      return;
    }

    output.system.push([
      "CrewBee runtime binding:",
      `- Team: ${binding.teamId}`,
      `- Entry Agent: ${binding.selectedAgentId}`,
      `- Active Owner: ${binding.activeOwnerId}`,
      `- Mode: ${binding.mode}`,
    ].join("\n"));
  };
}
