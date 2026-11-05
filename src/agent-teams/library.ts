import path from "node:path";

import type { AgentProfileSpec, AgentTeamDefinition, TeamLibrary } from "../core";

import type { TeamValidationIssue } from "./types";
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

interface RegisteredTeam {
  sourceScope: string;
  configPath: string;
  kind: "embedded" | "filesystem";
  rawTeam: AgentTeamDefinition;
  normalizedTeam: AgentTeamDefinition;
  orderedIndex: number;
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
function mergeTeamDefinitions(higher: AgentTeamDefinition, lower: AgentTeamDefinition): AgentTeamDefinition {
  const higherAgentsByCanonicalId = new Map<string, AgentProfileSpec>();
  for (const agent of higher.agents) {
    higherAgentsByCanonicalId.set(createCanonicalAgentId(higher.manifest.id, agent.metadata.id), agent);
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

  const usedCanonicalIds = new Set<string>();
  const usedTeamIds = new Map<string, RegisteredTeam>();
  const orderedTeams: AgentTeamDefinition[] = [];

  for (const entry of pendingTeams) {
    const loaded = entry.loader();
    configured.issues.push(...loaded.issues);
    if (loaded.team) {
      const existing = usedTeamIds.get(loaded.team.manifest.id);
      if (existing) {
        if (existing.kind === entry.kind) {
          // Same-kind collision (two file teams, or two embedded sources): unchanged
          // behavior — first source in sort order wins, the other one is skipped.
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

        // Cross-kind collision: a file team and the embedded team with the same id
        // merge per artifact — the file team wins where it defines an artifact, the
        // embedded team fills the gaps (agents, manifest, policy, docs). See the
        // "Customizing the built-in Coding Team (partial override)" README section.
        const teamId = loaded.team.manifest.id;
        const higherRaw = entry.kind === "filesystem" ? loaded.team : existing.rawTeam;
        const lowerRaw = entry.kind === "filesystem" ? existing.rawTeam : loaded.team;
        const mergedRaw = mergeTeamDefinitions(higherRaw, lowerRaw);

        // Free the canonical ids claimed by the registered team so the merged team
        // can be normalized from scratch, keeping every other team's claims intact.
        for (const agent of existing.normalizedTeam.agents) {
          usedCanonicalIds.delete(agent.metadata.id);
        }
        const claimedBeforeMerge = new Set(usedCanonicalIds);
        const restoreExistingClaims = () => {
          usedCanonicalIds.clear();
          for (const claimed of claimedBeforeMerge) {
            usedCanonicalIds.add(claimed);
          }
          for (const agent of existing.normalizedTeam.agents) {
            usedCanonicalIds.add(agent.metadata.id);
          }
        };

        const normalizedMerge = normalizeTeamAgentIds({ team: mergedRaw, usedCanonicalIds });
        if (!normalizedMerge.team) {
          restoreExistingClaims();
          configured.issues.push(...normalizedMerge.issues.map((issue) => ({
            level: "warning" as const,
            filePath: issue.filePath ?? entry.configPath,
            code: issue.code ?? "team_merge_failed",
            path: issue.path,
            suggestion: issue.suggestion,
            message: `Skipped merging ${entry.sourceScope} source into Team '${teamId}': ${issue.message}`,
          })));
          continue;
        }

        const mergeValidationIssues = validateTeamDefinition(normalizedMerge.team);
        const mergeErrors = mergeValidationIssues.filter((issue) => issue.level === "error");
        if (mergeErrors.length > 0) {
          restoreExistingClaims();
          configured.issues.push(...mergeErrors.map((issue) => ({
            level: "warning" as const,
            filePath: issue.filePath ?? entry.configPath,
            code: issue.code ?? "team_merge_failed",
            path: issue.path,
            suggestion: issue.suggestion,
            message: `Skipped merging ${entry.sourceScope} source into Team '${teamId}': ${issue.message}`,
          })));
          continue;
        }

        configured.issues.push(...normalizedMerge.issues);
        configured.issues.push(...mergeValidationIssues.filter((issue) => issue.level === "warning"));
        orderedTeams[existing.orderedIndex] = normalizedMerge.team;
        usedTeamIds.set(teamId, {
          ...existing,
          kind: "filesystem",
          rawTeam: mergedRaw,
          normalizedTeam: normalizedMerge.team,
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
          kind: entry.kind,
          rawTeam: loaded.team,
          normalizedTeam: normalized.team,
          orderedIndex: orderedTeams.length - 1,
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
