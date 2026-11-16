import type { AgentTeamDefinition, CollaborationBindingInput } from "../core";

import type { TeamValidationIssue } from "./types";

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function resolveTeamStem(teamId: string): string {
  const normalized = sanitizeSegment(teamId);
  return normalized.endsWith("-team") ? normalized.slice(0, -5) : normalized;
}

function resolveAgentSlug(agentId: string): string {
  return sanitizeSegment(agentId);
}

export function createCanonicalAgentId(teamId: string, agentId: string): string {
  const teamStem = resolveTeamStem(teamId);
  const agentSlug = resolveAgentSlug(agentId);

  if (!teamStem) {
    return agentSlug;
  }

  return agentSlug === teamStem || agentSlug.startsWith(`${teamStem}-`) ? agentSlug : `${teamStem}-${agentSlug}`;
}

export function createFallbackCanonicalAgentId(teamId: string, agentId: string): string {
  return `${sanitizeSegment(teamId)}-${resolveAgentSlug(agentId)}`;
}

function rewriteBinding(binding: CollaborationBindingInput, resolveRef: (ref: string) => string): CollaborationBindingInput {
  if (typeof binding === "string") {
    return resolveRef(binding);
  }

  return {
    ...binding,
    agentRef: resolveRef(binding.agentRef),
  };
}

export function normalizeTeamAgentIds(input: {
  team: AgentTeamDefinition;
  usedCanonicalIds: Set<string>;
}): { team?: AgentTeamDefinition; issues: TeamValidationIssue[] } {
  const issues: TeamValidationIssue[] = [];
  const nextUsedIds = new Set(input.usedCanonicalIds);
  const localAssignedIds = new Set<string>();
  const agentIdMap = new Map<string, string>();

  for (const agent of input.team.agents) {
    const sourceId = agent.metadata.id;
    const candidate = createCanonicalAgentId(input.team.manifest.id, sourceId);
    const fallback = createFallbackCanonicalAgentId(input.team.manifest.id, sourceId);

    let assigned = candidate;
    if (nextUsedIds.has(assigned) || localAssignedIds.has(assigned)) {
      assigned = fallback;
    }

    if (nextUsedIds.has(assigned) || localAssignedIds.has(assigned)) {
      issues.push({
        level: "error",
        code: "canonical_agent_id_collision",
        message: `Team '${input.team.manifest.id}' cannot assign a unique canonicalAgentId for source agent '${sourceId}'. Candidate '${candidate}' and fallback '${fallback}' both collide.`,
        path: `agents.${sourceId}.id`,
        suggestion: "Rename the source Agent id or Team id so CrewBee can derive a unique canonical Agent id.",
      });
      return { issues };
    }

    agentIdMap.set(sourceId, assigned);
    localAssignedIds.add(assigned);
    nextUsedIds.add(assigned);
  }

  // Resolve both raw and already-canonical references after artifact replacement.
  // Exact source IDs take precedence when a Team contains ambiguous aliases.
  const canonicalAliases = new Map<string, string[]>();
  for (const [sourceId, assigned] of agentIdMap) {
    const canonical = createCanonicalAgentId(input.team.manifest.id, sourceId);
    canonicalAliases.set(canonical, [...(canonicalAliases.get(canonical) ?? []), assigned]);
  }
  const resolveRef = (ref: string): string => {
    if (agentIdMap.has(ref)) return agentIdMap.get(ref)!;
    const aliases = canonicalAliases.get(createCanonicalAgentId(input.team.manifest.id, ref));
    return aliases?.length === 1 ? aliases[0]! : ref;
  };

  const normalizedTeam: AgentTeamDefinition = {
    ...input.team,
    manifest: {
      ...input.team.manifest,
      leader: {
        ...input.team.manifest.leader,
        agentRef: resolveRef(input.team.manifest.leader.agentRef),
      },
      members: Object.fromEntries(
        Object.entries(input.team.manifest.members).map(([agentId, guidance]) => [
          resolveRef(agentId),
          guidance,
        ]),
      ),
      agentRuntime: input.team.manifest.agentRuntime
        ? Object.fromEntries(
            Object.entries(input.team.manifest.agentRuntime).map(([agentId, runtime]) => [
              resolveRef(agentId),
              runtime,
            ]),
          )
        : undefined,
    },
    modelConfigOverride: input.team.modelConfigOverride
      ? {
          ...input.team.modelConfigOverride,
          agents: input.team.modelConfigOverride.agents
            ? Object.fromEntries(
                Object.entries(input.team.modelConfigOverride.agents).map(([agentId, override]) => [
                  resolveRef(agentId),
                  override,
                ]),
              )
            : undefined,
        }
      : undefined,
    agents: input.team.agents.map((agent) => {
      const canonicalAgentId = agentIdMap.get(agent.metadata.id) ?? agent.metadata.id;
      return {
        ...agent,
        canonicalAgentId,
        metadata: {
          ...agent.metadata,
          id: canonicalAgentId,
          sourceId: agent.metadata.sourceId ?? agent.metadata.id,
          name: canonicalAgentId,
        },
        collaboration: {
          defaultConsults: agent.collaboration.defaultConsults.map((binding) => rewriteBinding(binding, resolveRef)),
          defaultHandoffs: agent.collaboration.defaultHandoffs.map((binding) => rewriteBinding(binding, resolveRef)),
        },
        entryPoint: agent.entryPoint
          ? {
              ...agent.entryPoint,
              selectionLabel: canonicalAgentId,
            }
          : agent.entryPoint,
      };
    }),
  };

  input.usedCanonicalIds.clear();
  for (const usedId of nextUsedIds) {
    input.usedCanonicalIds.add(usedId);
  }

  return {
    team: normalizedTeam,
    issues,
  };
}
