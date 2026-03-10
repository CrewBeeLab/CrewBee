import type { AgentTeamDefinition, TeamLibrary } from "../core";

import { createEmbeddedCodingTeam } from "./embedded/coding-team";
import { listTeamDirectories, loadTeamDefinitionFromDirectory, resolveTeamConfigRoot } from "./filesystem";

export function loadTeamLibraryFromDirectory(
  teamRoot: string = resolveTeamConfigRoot(),
  workspaceRoot: string = process.cwd(),
): TeamLibrary {
  return {
    version: "file-config-v1",
    teams: listTeamDirectories(teamRoot).map((teamDir) => loadTeamDefinitionFromDirectory(teamDir, workspaceRoot)),
  };
}

export function loadDefaultTeamLibrary(baseDir: string = process.cwd()): TeamLibrary {
  const configuredLibrary = loadTeamLibraryFromDirectory(resolveTeamConfigRoot(baseDir), baseDir);

  return {
    version: "hybrid-v1",
    teams: [createEmbeddedCodingTeam(), ...configuredLibrary.teams],
  };
}

export function findTeam(teamId: string, teamLibrary: TeamLibrary): AgentTeamDefinition | undefined {
  return teamLibrary.teams.find((team) => team.manifest.id === teamId);
}
