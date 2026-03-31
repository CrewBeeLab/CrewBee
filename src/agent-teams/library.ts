import path from "node:path";

import type { AgentTeamDefinition, TeamLibrary } from "../core";

import type { TeamValidationIssue } from "./types";
import { createEmbeddedCodingTeam } from "./embedded/coding-team";
import { listTeamDirectories, loadTeamDefinitionFromDirectory, resolveTeamConfigRoot } from "./filesystem";
import { validateTeamDefinition } from "./validation";

function createSkippedTeamIssue(teamDir: string, message: string): TeamValidationIssue {
  return {
    level: "warning",
    filePath: teamDir,
    message: `Skipped Team '${path.basename(teamDir)}': ${message}`,
  };
}

function loadValidatedTeamDefinition(input: {
  teamDir: string;
  workspaceRoot: string;
}): { team?: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  try {
    const team = loadTeamDefinitionFromDirectory(input.teamDir, input.workspaceRoot);
    const issues = validateTeamDefinition(team);
    const errors = issues.filter((issue) => issue.level === "error");

    if (errors.length > 0) {
      return {
        issues: errors.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
      };
    }

    return {
      team,
      issues: issues.filter((issue) => issue.level === "warning"),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      issues: [createSkippedTeamIssue(input.teamDir, message)],
    };
  }
}

export function loadTeamLibraryFromDirectory(
  teamRoot: string = resolveTeamConfigRoot(),
  workspaceRoot: string = process.cwd(),
): TeamLibrary {
  const configuredTeams = listTeamDirectories(teamRoot).map((teamDir) => loadValidatedTeamDefinition({ teamDir, workspaceRoot }));

  return {
    version: "file-config-v1",
    teams: configuredTeams.flatMap((entry) => (entry.team ? [entry.team] : [])),
    loadIssues: configuredTeams.flatMap((entry) => entry.issues),
  };
}

export function loadDefaultTeamLibrary(baseDir: string = process.cwd()): TeamLibrary {
  const configuredLibrary = loadTeamLibraryFromDirectory(resolveTeamConfigRoot(baseDir), baseDir);

  return {
    version: "hybrid-v1",
    teams: [createEmbeddedCodingTeam(), ...configuredLibrary.teams],
    loadIssues: configuredLibrary.loadIssues,
  };
}

export function findTeam(teamId: string, teamLibrary: TeamLibrary): AgentTeamDefinition | undefined {
  return teamLibrary.teams.find((team) => team.manifest.id === teamId);
}
