import type { TeamValidationIssue } from "./types";

export interface TeamDiagnosticsResult {
  healthy: boolean;
  issueCount: number;
  blockingIssueCount: number;
}

export function isBlockingTeamIssue(issue: TeamValidationIssue): boolean {
  return issue.level === "error" && issue.blocking !== false;
}

export function summarizeTeamDiagnostics(issues: TeamValidationIssue[]): TeamDiagnosticsResult {
  const blockingIssueCount = issues.filter(isBlockingTeamIssue).length;
  return {
    healthy: issues.length === 0,
    issueCount: issues.length,
    blockingIssueCount,
  };
}

export function formatTeamValidationIssue(issue: TeamValidationIssue): string {
  const parts = [
    `${issue.level.toUpperCase()}: ${issue.message}`,
    issue.code ? `code=${issue.code}` : undefined,
    issue.sourceScope ? `scope=${issue.sourceScope}` : undefined,
    issue.filePath ? `file=${issue.filePath}` : undefined,
    issue.path ? `path=${issue.path}` : undefined,
    issue.fixable ? "fixable=yes" : undefined,
    issue.suggestion ? `suggestion=${issue.suggestion}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));

  return parts.join(" | ");
}
