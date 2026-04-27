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
        ...loadIssues.map((issue) => {
          const details = [
            issue.code,
            issue.sourceScope ? `scope=${issue.sourceScope}` : undefined,
            issue.filePath,
            issue.path ? `path=${issue.path}` : undefined,
            issue.suggestion ? `suggestion=${issue.suggestion}` : undefined,
          ].filter(Boolean).join("; ");
          return `  - ${issue.message}${details ? ` (${details})` : ""}`;
        }),
      );
    }

    output.system.push(lines.join("\n"));
  };
}
