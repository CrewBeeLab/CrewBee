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
  loadTeamDefinitionFromDirectoryWithIssues,
  resolveTeamConfigRoot,
  type ConfiguredTeamSource,
} from "./filesystem";
import { validateTeamDefinition } from "./validation";

function createSkippedTeamIssue(teamDir: string, message: string): TeamValidationIssue {
  return {
    level: "warning",
    filePath: teamDir,
    code: "team_load_failed",
    message: `Skipped Team '${path.basename(teamDir)}': ${message}`,
    suggestion: "Fix this Team directory; CrewBee will continue loading other valid Teams.",
  };
}

export interface LoadDefaultTeamLibraryOptions {
  globalConfigRoot?: string;
  projectWorktree?: string;
}

function loadValidatedTeamDefinition(input: {
  teamDir: string;
  workspaceRoot: string;
  usedCanonicalIds: Set<string>;
}): { team?: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  try {
    const loaded = loadTeamDefinitionFromDirectoryWithIssues(input.teamDir, input.workspaceRoot);
    const loadedTeam = loaded.team;
    const normalized = normalizeTeamAgentIds({ team: loadedTeam, usedCanonicalIds: input.usedCanonicalIds });
    if (!normalized.team) {
      return {
        issues: [
          ...loaded.issues,
          ...normalized.issues.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
        ],
      };
    }

    const issues = [...normalized.issues, ...validateTeamDefinition(normalized.team)];
    const errors = issues.filter((issue) => issue.level === "error");

    if (errors.length > 0) {
      return {
        issues: [
          ...loaded.issues,
          ...errors.map((issue) => createSkippedTeamIssue(input.teamDir, issue.message)),
        ],
      };
    }

    return {
      team: normalized.team,
      issues: [...loaded.issues, ...issues.filter((issue) => issue.level === "warning")],
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

export function loadDefaultTeamLibrary(input: string | LoadDefaultTeamLibraryOptions = process.cwd()): TeamLibrary {
  const baseDir = typeof input === "string"
    ? input
    : (input.projectWorktree ?? process.cwd());
  const configured = listConfiguredTeamSources(
    typeof input === "string"
      ? { projectWorktree: input }
      : { globalConfigRoot: input.globalConfigRoot, projectWorktree: input.projectWorktree },
  );
  const pendingTeams: Array<{
    loader: () => { team?: AgentTeamDefinition; issues: TeamValidationIssue[] };
    priority: number;
    order: number;
    sourcePrecedence: number;
    sourceScope: string;
    configPath: string;
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
        loader: () => ({
          team: embeddedTeam.team
            ? { ...embeddedTeam.team, modelConfigOverride: source.modelConfigOverride }
            : undefined,
          issues: [],
        }),
        priority: source.priority,
        order: source.order,
        sourcePrecedence: source.sourcePrecedence,
        sourceScope: source.sourceScope,
        configPath: source.configPath,
      });
      continue;
    }

    pendingTeams.push({
      loader: () => {
        try {
          const loaded = loadTeamDefinitionFromDirectoryWithIssues(source.teamDir, baseDir);
          return {
            team: { ...loaded.team, modelConfigOverride: source.modelConfigOverride },
            issues: loaded.issues,
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
      sourcePrecedence: source.sourcePrecedence,
      sourceScope: source.sourceScope,
      configPath: source.configPath,
    });
  }

  pendingTeams.sort((left, right) => {
    const sourceOrder = left.sourcePrecedence - right.sourcePrecedence;
    if (sourceOrder !== 0) {
      return sourceOrder;
    }

    const priorityOrder = left.priority - right.priority;
    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.order - right.order;
  });

  const usedCanonicalIds = new Set<string>();
  const usedTeamIds = new Map<string, { sourceScope: string; configPath: string }>();
  const orderedTeams: AgentTeamDefinition[] = [];

  for (const entry of pendingTeams) {
    const loaded = entry.loader();
    configured.issues.push(...loaded.issues);
    if (loaded.team) {
      const existing = usedTeamIds.get(loaded.team.manifest.id);
      if (existing) {
        configured.issues.push({
          level: "warning",
          filePath: entry.configPath,
          code: "team_id_shadowed_or_duplicate",
          sourceScope: entry.sourceScope === "project" || entry.sourceScope === "global" ? entry.sourceScope : undefined,
          message: entry.sourceScope === "global" && existing.sourceScope === "project"
            ? `Project Team '${loaded.team.manifest.id}' shadows global Team '${loaded.team.manifest.id}'.`
            : `Skipped Team '${loaded.team.manifest.id}': duplicate Team id already loaded from ${existing.sourceScope} source.`,
          suggestion: entry.sourceScope === "global" && existing.sourceScope === "project"
            ? "This is expected when a project intentionally overrides a global Team id."
            : "Rename one Team id or disable one Team entry.",
        });
        continue;
      }

      const usedCanonicalIdsBeforeNormalize = new Set(usedCanonicalIds);
      const normalized = normalizeTeamAgentIds({
        team: loaded.team,
        usedCanonicalIds,
      });
      configured.issues.push(...normalized.issues);
      if (normalized.team) {
        const validationIssues = validateTeamDefinition(normalized.team);
        const errors = validationIssues.filter((issue) => issue.level === "error");
        if (errors.length > 0) {
          usedCanonicalIds.clear();
          for (const usedId of usedCanonicalIdsBeforeNormalize) {
            usedCanonicalIds.add(usedId);
          }
          configured.issues.push(...errors.map((issue) => ({
            level: "warning" as const,
            filePath: issue.filePath,
            code: issue.code ?? "team_validation_failed",
            path: issue.path,
            suggestion: issue.suggestion,
            message: `Skipped Team '${normalized.team?.manifest.id ?? "unknown"}': ${issue.message}`,
          })));
          continue;
        }
        configured.issues.push(...validationIssues.filter((issue) => issue.level === "warning"));
        orderedTeams.push(normalized.team);
        usedTeamIds.set(normalized.team.manifest.id, {
          sourceScope: entry.sourceScope,
          configPath: entry.configPath,
        });
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
