import type { SessionRuntimeBinding } from "../../runtime";
import type { TeamValidationIssue } from "../../agent-teams";

export function createSystemTransformHook(
  bindings: Map<string, SessionRuntimeBinding>,
  getLoadIssues: () => TeamValidationIssue[] = () => [],
) {
  return async (input: { sessionID?: string; model: unknown }, output: { system: string[] }) => {
    if (!input.sessionID) {
      return;
    }

    const binding = bindings.get(input.sessionID);
    if (!binding) {
      return;
    }

    const lines = [
      "CrewBee runtime binding:",
      `- Team: ${binding.teamId}`,
      `- Entry Agent: ${binding.selectedAgentId}`,
      `- Active Owner: ${binding.activeOwnerId}`,
      `- Mode: ${binding.mode}`,
    ];
    const loadIssues = getLoadIssues();

    if (loadIssues.length > 0) {
      lines.push(
        "- Team Load Warnings:",
        ...loadIssues.map((issue) => `  - ${issue.message}${issue.filePath ? ` (${issue.filePath})` : ""}`),
      );
    }

    output.system.push(lines.join("\n"));
  };
}
