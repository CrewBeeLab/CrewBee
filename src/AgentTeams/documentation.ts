import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { TeamDocumentationRefs } from "../core";

import { TEAM_CONFIG_ROOT } from "./constants";

export function resolveTeamDocumentation(
  teamDir: string,
  workspaceRoot: string = process.cwd(),
): TeamDocumentationRefs | undefined {
  const docCandidates = [
    path.join(teamDir, "docs", "TEAM.md"),
    path.join(teamDir, "TEAM.md"),
    path.join(teamDir, "README.md"),
  ];
  const teamDocPath = docCandidates.find((candidate) => existsSync(candidate));
  const agentsDir = path.join(teamDir, "agents");
  const teamDirName = path.basename(teamDir);
  const agentProfiles = existsSync(agentsDir)
    ? readdirSync(agentsDir)
        .filter((entry) => entry.endsWith(".agent.md"))
        .map((entry) => path.posix.join(TEAM_CONFIG_ROOT, teamDirName, "agents", entry))
        .sort()
    : [];

  if (!teamDocPath && agentProfiles.length === 0) {
    return undefined;
  }

  return {
    teamReadme: teamDocPath ? path.relative(workspaceRoot, teamDocPath).replace(/\\/g, "/") : "",
    agentProfiles: agentProfiles.length > 0 ? agentProfiles : undefined,
  };
}
