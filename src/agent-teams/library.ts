import path from "node:path";

import type { AgentProfileSpec, AgentTeamDefinition, TeamLibrary } from "../core";

import type { TeamSourceDefinition, TeamValidationIssue } from "./types";
import { createCanonicalAgentId, normalizeTeamAgentIds } from "./canonical-agent-id";
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

/**
 * Per-artifact merge of two Team definitions with the same manifest id.
 * `higher` wins on every artifact it defines; `lower` fills the gaps:
 *
 * - manifest: `higher` wins wholesale (required field).
 * - policy: `higher.policy ?? lower.policy` (a partial file team may omit team.policy.yaml).
 * - agents: `lower`'s agent list, with `higher`'s agents replacing them by canonical
 *   id; agents only `higher` defines are appended. Keying by canonical id lets a file
 *   team name agents either raw (`reviewer`) or already canonical (`coding-reviewer`).
 * - documentation / modelConfigOverride: `higher` wins when present.
 *
 * Both inputs are raw (pre-normalization) definitions loaded from their sources.
 */
function mergeTeamDefinitions(higher: TeamSourceDefinition, lower: TeamSourceDefinition): TeamSourceDefinition {
  const higherAgentsByCanonicalId = new Map<string, AgentProfileSpec>();
  for (const agent of higher.agents) {
    const key = createCanonicalAgentId(higher.manifest.id, agent.metadata.id);
    if (higherAgentsByCanonicalId.has(key)) {
      throw new Error(`Duplicate override for canonical Agent '${key}'.`);
    }
    higherAgentsByCanonicalId.set(key, agent);
  }

  const mergedAgents: AgentProfileSpec[] = [];
  const mergedKeys = new Set<string>();
  for (const agent of lower.agents) {
    const key = createCanonicalAgentId(lower.manifest.id, agent.metadata.id);
    mergedKeys.add(key);
    mergedAgents.push(higherAgentsByCanonicalId.get(key) ?? agent);
  }
  for (const [key, agent] of higherAgentsByCanonicalId) {
    if (!mergedKeys.has(key)) {
      mergedAgents.push(agent);
    }
  }

  return {
    manifest: higher.manifest,
    policy: higher.policy ?? lower.policy,
    agents: mergedAgents,
    documentation: higher.documentation ?? lower.documentation,
    modelConfigOverride: higher.modelConfigOverride ?? lower.modelConfigOverride,
  };
}

function requireTeamPolicy(team: TeamSourceDefinition): AgentTeamDefinition {
  if (!team.policy) {
    throw new Error(`Team '${team.manifest.id}' must define team.policy.yaml or inherit an enabled embedded policy.`);
  }
  return { ...team, policy: team.policy };
}

function loadValidatedTeamDefinition(input: {
  teamDir: string;
  workspaceRoot: string;
  usedCanonicalIds: Set<string>;
}): { team?: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  try {
    const loaded = loadTeamDefinitionFromDirectoryWithIssues(input.teamDir, input.workspaceRoot);
    const loadedTeam = requireTeamPolicy(loaded.team);
    const claims = new Set(input.usedCanonicalIds);
    const normalized = normalizeTeamAgentIds({ team: loadedTeam, usedCanonicalIds: claims });
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

    for (const id of claims) input.usedCanonicalIds.add(id);
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
    loader: () => { team?: TeamSourceDefinition; issues: TeamValidationIssue[] };
    kind: "embedded" | "filesystem";
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
        kind: "embedded",
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
      kind: "filesystem",
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

  // Read every source before validating: a partial project source can precede
  // its embedded base. Source order still controls file/file shadowing.
  const loadedEntries = pendingTeams.flatMap((entry, index) => {
    const loaded = entry.loader();
    configured.issues.push(...loaded.issues);
    return loaded.team ? [{ ...entry, index, team: loaded.team }] : [];
  });
  const embeddedById = new Map<string, (typeof loadedEntries)[number]>();
  for (const entry of loadedEntries) {
    if (entry.kind === "embedded" && !embeddedById.has(entry.team.manifest.id)) {
      embeddedById.set(entry.team.manifest.id, entry);
    }
  }

  const usedCanonicalIds = new Set<string>();
  const usedTeamIds = new Map<string, (typeof loadedEntries)[number]>();
  const resolvedTeams: Array<{ index: number; team: AgentTeamDefinition }> = [];
  // File candidates are composed first; embedded definitions remain fallbacks.
  // The winning source's original index determines final Team ordering.
  const groups = new Map<string, typeof loadedEntries>();
  for (const entry of loadedEntries) {
    const id = entry.team.manifest.id;
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  const orderedGroups = [...groups.values()].map((entries) => [
    ...entries.filter((entry) => entry.kind === "filesystem"),
    ...entries.filter((entry) => entry.kind === "embedded"),
  ]).sort((left, right) => left[0]!.index - right[0]!.index);
  const candidates = orderedGroups.flat();
  for (const entry of candidates) {
    const teamId = entry.team.manifest.id;
    const existing = usedTeamIds.get(teamId);
    if (existing) {
      if (entry.kind !== existing.kind) continue;
      configured.issues.push({
        level: "warning",
        code: "team_id_shadowed_or_duplicate",
        filePath: entry.configPath,
        sourceScope: entry.sourceScope === "project" ? "project" : "global",
        message: entry.sourceScope === "global" && existing.sourceScope === "project"
          ? `Project Team '${teamId}' shadows global Team '${teamId}'.`
          : `Skipped Team '${teamId}': duplicate Team id already loaded from ${existing.sourceScope} source.`,
        suggestion: "Rename one Team id or disable one Team entry unless this override is intentional.",
      });
      continue;
    }
    const base = entry.kind === "filesystem" ? embeddedById.get(teamId) : undefined;
    const claims = new Set(usedCanonicalIds);
    try {
      const raw = base ? mergeTeamDefinitions(entry.team, base.team) : entry.team;
      const complete = requireTeamPolicy(raw);
      const normalized = normalizeTeamAgentIds({ team: complete, usedCanonicalIds: claims });
      const issues = [...normalized.issues, ...(normalized.team ? validateTeamDefinition(normalized.team) : [])];
      if (!normalized.team || issues.some((issue) => issue.level === "error")) {
        configured.issues.push(...issues.map((issue) => ({
          ...issue,
          level: "warning" as const,
          filePath: issue.filePath ?? entry.configPath,
          message: `Skipped Team '${teamId}': ${issue.message}`,
        })));
        continue;
      }
      configured.issues.push(...issues);
      for (const id of claims) usedCanonicalIds.add(id);
      resolvedTeams.push({ index: entry.index, team: normalized.team });
      usedTeamIds.set(teamId, entry);
    } catch (error) {
      configured.issues.push(createSkippedTeamIssue(teamId, error instanceof Error ? error.message : String(error)));
    }
  }
  const orderedTeams = resolvedTeams.sort((left, right) => left.index - right.index).map((entry) => entry.team);

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
