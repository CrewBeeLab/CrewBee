import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { TeamDocumentationRefs } from "../core";

function toWorkspaceRelativePath(filePath: string, workspaceRoot: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, "/");
}

export function resolveTeamDocumentation(
  teamDir: string,
  workspaceRoot: string = process.cwd(),
): TeamDocumentationRefs | undefined {
  const docCandidates = [
    path.join(teamDir, "TEAM.md"),
    path.join(teamDir, "README.md"),
  ];
  const teamDocPath = docCandidates.find((candidate) => existsSync(candidate));
  const agentProfiles = readdirSync(teamDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".agent.md"))
    .map((entry) => toWorkspaceRelativePath(path.join(teamDir, entry.name), workspaceRoot))
    .sort();

  if (!teamDocPath && agentProfiles.length === 0) {
    return undefined;
  }

  return {
    teamReadme: teamDocPath ? toWorkspaceRelativePath(teamDocPath, workspaceRoot) : "",
    agentProfiles: agentProfiles.length > 0 ? agentProfiles : undefined,
  };
}
