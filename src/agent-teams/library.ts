import path from "node:path";

import type { AgentTeamDefinition, TeamLibrary } from "../core";

import type { TeamValidationIssue } from "./types";
import { normalizeTeamAgentIds } from "./canonical-agent-id";
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
  usedCanonicalIds: Set<string>;
}): { team?: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  try {
    const loadedTeam = loadTeamDefinitionFromDirectory(input.teamDir, input.workspaceRoot);
    const normalized = normalizeTeamAgentIds({ team: loadedTeam, usedCanonicalIds: input.usedCanonicalIds });
    if (!normalized.team) {
      return {
        issues: normalized.issues.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
      };
    }

    const issues = [...normalized.issues, ...validateTeamDefinition(normalized.team)];
    const errors = issues.filter((issue) => issue.level === "error");

    if (errors.length > 0) {
      return {
        issues: errors.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
      };
    }

    return {
      team: normalized.team,
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
  const usedCanonicalIds = new Set<string>();
  const configuredTeams = listTeamDirectories(teamRoot).map((teamDir) => loadValidatedTeamDefinition({
    teamDir,
    workspaceRoot,
    usedCanonicalIds,
  }));

  return {
    version: "file-config-v1",
    teams: configuredTeams.flatMap((entry) => (entry.team ? [entry.team] : [])),
    loadIssues: configuredTeams.flatMap((entry) => entry.issues),
  };
}

export function loadDefaultTeamLibrary(baseDir: string = process.cwd()): TeamLibrary {
  const configured = listConfiguredTeamSources();
  const pendingTeams: Array<{
    loader: () => { team?: AgentTeamDefinition; issues: TeamValidationIssue[] };
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

      pendingTeams.push({
        loader: () => ({ team: embeddedTeam.team, issues: [] }),
        priority: source.priority,
        order: source.order,
      });
      continue;
    }

    pendingTeams.push({
      loader: () => {
        try {
          return {
            team: loadTeamDefinitionFromDirectory(source.teamDir, baseDir),
            issues: [],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            issues: [createSkippedTeamIssue(source.teamDir, message)],
          };
        }
      },
      priority: source.priority,
      order: source.order,
    });
  }

  pendingTeams.sort((left, right) => {
    const priorityOrder = left.priority - right.priority;
    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.order - right.order;
  });

  const usedCanonicalIds = new Set<string>();
  const orderedTeams: AgentTeamDefinition[] = [];

  for (const entry of pendingTeams) {
    const loaded = entry.loader();
    configured.issues.push(...loaded.issues);
    if (loaded.team) {
      const normalized = normalizeTeamAgentIds({
        team: loaded.team,
        usedCanonicalIds,
      });
      configured.issues.push(...normalized.issues);
      if (normalized.team) {
        const validationIssues = validateTeamDefinition(normalized.team);
        const errors = validationIssues.filter((issue) => issue.level === "error");
        if (errors.length > 0) {
          configured.issues.push(...errors.map((issue) => ({
            level: "warning" as const,
            filePath: issue.filePath,
            message: `Skipped Team '${normalized.team?.manifest.id ?? "unknown"}': ${issue.message}`,
          })));
          continue;
        }
        configured.issues.push(...validationIssues.filter((issue) => issue.level === "warning"));
        orderedTeams.push(normalized.team);
      }
    }
  }

  return {
    version: "config-driven-v1",
    teams: orderedTeams,
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
