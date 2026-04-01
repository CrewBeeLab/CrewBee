import path from "node:path";

import type { AgentTeamDefinition, TeamLibrary } from "../core";

import type { TeamValidationIssue } from "./types";
import { BUILTIN_CODING_TEAM_ID } from "./constants";
import { createEmbeddedCodingTeam } from "./embedded/coding-team";
import {
  listConfiguredTeamSources,
  listTeamDirectories,
  loadTeamDefinitionFromDirectory,
  resolveTeamConfigRoot,
  type ConfiguredTeamSource,
} from "./filesystem";
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
  const configured = listConfiguredTeamSources();
  const orderedTeams: Array<{
    team: AgentTeamDefinition;
    priority: number;
    order: number;
  }> = [];

  for (const source of configured.sources) {
    if (!source.enabled) {
      continue;
    }

    if (source.kind === "embedded") {
      const embeddedTeam = loadEmbeddedTeam(source);
      configured.issues.push(...embeddedTeam.issues);

      if (!embeddedTeam.team) {
        continue;
      }

      orderedTeams.push({
        team: embeddedTeam.team,
        priority: source.priority,
        order: source.order,
      });
      continue;
    }

    const loaded = loadValidatedTeamDefinition({
      teamDir: source.teamDir,
      workspaceRoot: baseDir,
    });
    configured.issues.push(...loaded.issues);

    if (!loaded.team) {
      continue;
    }

    orderedTeams.push({
      team: loaded.team,
      priority: source.priority,
      order: source.order,
    });
  }

  orderedTeams.sort((left, right) => {
    const priorityOrder = left.priority - right.priority;
    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.order - right.order;
  });

  return {
    version: "config-driven-v1",
    teams: orderedTeams.map((entry) => entry.team),
    loadIssues: configured.issues,
  };
}

function loadEmbeddedTeam(source: Extract<ConfiguredTeamSource, { kind: "embedded" }>): {
  team?: AgentTeamDefinition;
  issues: TeamValidationIssue[];
} {
  if (source.teamId === BUILTIN_CODING_TEAM_ID) {
    return {
      team: createEmbeddedCodingTeam(),
      issues: [],
    };
  }

  return {
    issues: [{
      level: "warning",
      filePath: source.teamId,
      message: `Skipped embedded Team '${source.teamId}': unknown embedded Team id.`,
    }],
  };
}

export function findTeam(teamId: string, teamLibrary: TeamLibrary): AgentTeamDefinition | undefined {
  return teamLibrary.teams.find((team) => team.manifest.id === teamId);
}
