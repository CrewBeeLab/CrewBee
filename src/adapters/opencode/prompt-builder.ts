import type { LoadedProfileDocument } from "../../core";
import { buildPromptCatalog } from "../../catalog/build-prompt-catalog";
import { attachMarkdownBodySections } from "../../loader/markdown-body-loader";
import { loadAgentProfile, loadTeamManifest, loadTeamPolicy } from "../../loader/profile-loader";
import { buildAgentPromptSource, buildAgentPromptSourceWithOverrides } from "../../normalize/build-agent-prompt-source";
import { buildTeamPromptSource } from "../../normalize/build-team-prompt-source";
import { normalizeProfileDocument } from "../../normalize/normalize-document";
import { buildPromptPlan } from "../../plan/build-prompt-plan";
import { applyPromptProjection } from "../../projection/apply-prompt-projection";
import { defaultRenderContext, renderPromptPlan } from "../../render/structural-renderer";
import type { ProjectedAgent } from "../../runtime";

type UnknownRecord = Record<string, unknown>;

function resolveTargetAgent(team: ProjectedAgent["sourceTeam"], agentRef: string) {
  return team.agents.find((candidate) => candidate.metadata.id === agentRef);
}

function createCollaborationPromptValue(agent: ProjectedAgent): unknown {
  const team = agent.sourceTeam;

  const mapBinding = (binding: ProjectedAgent["sourceAgent"]["collaboration"]["defaultConsults"][number]) => {
    const agentRef = typeof binding === "string" ? binding : binding.agentRef;
    const targetAgent = resolveTargetAgent(team, agentRef);
    const member = team.manifest.members[agentRef];
    const fallbackDescription = typeof binding === "string" ? undefined : binding.description;

    return {
      id: targetAgent
        ? targetAgent.canonicalAgentId ?? targetAgent.metadata.id
        : agentRef,
      description: member?.responsibility ?? targetAgent?.responsibilityCore.description ?? fallbackDescription ?? agentRef,
      ...(member?.delegateWhen ? { when_to_delegate: member.delegateWhen } : {}),
    };
  };

  return {
    defaultConsults: agent.sourceAgent.collaboration.defaultConsults.map(mapBinding),
    defaultHandoffs: agent.sourceAgent.collaboration.defaultHandoffs.map(mapBinding),
  };
}

function renderPromptDocument(document: LoadedProfileDocument): string {
  const normalized = normalizeProfileDocument(document);
  const catalog = buildPromptCatalog(normalized);
  const projectedCatalog = applyPromptProjection(catalog, normalized.promptProjection);
  const plan = buildPromptPlan(projectedCatalog);
  return renderPromptPlan(plan, defaultRenderContext);
}

function renderPart(title: string, body: string): string | undefined {
  return body.trim().length > 0 ? `## ${title}\n\n${body}` : undefined;
}

export function createOpenCodePromptFromDocuments(input: {
  team: LoadedProfileDocument;
  agent: LoadedProfileDocument;
}): string {
  const teamPart = renderPromptDocument(input.team);
  const agentPart = renderPromptDocument(input.agent);

  return [renderPart("Team Contract", teamPart), renderPart("Agent Contract", agentPart)]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}

export function createOpenCodePromptFromRawDocuments(input: {
  teamManifestRaw: UnknownRecord;
  teamPolicyRaw: UnknownRecord;
  agentRaw: UnknownRecord;
  teamBody?: string;
  agentBody?: string;
}): string {
  const loadedTeamManifest = input.teamBody
    ? attachMarkdownBodySections(loadTeamManifest(input.teamManifestRaw), input.teamBody)
    : loadTeamManifest(input.teamManifestRaw);
  const loadedAgent = input.agentBody
    ? attachMarkdownBodySections(loadAgentProfile(input.agentRaw), input.agentBody)
    : loadAgentProfile(input.agentRaw);
  const normalizedAgent = normalizeProfileDocument(loadedAgent);
  const agentPart = renderPromptPlan(
    buildPromptPlan(applyPromptProjection(buildPromptCatalog(normalizedAgent), normalizedAgent.promptProjection)),
    defaultRenderContext,
  );

  const loadedPolicy = loadTeamPolicy(input.teamPolicyRaw);
  const teamSource = buildTeamPromptSource(
    {
      id: String(loadedTeamManifest.metadata.id),
      name: typeof loadedTeamManifest.metadata.name === "string" ? loadedTeamManifest.metadata.name : undefined,
      promptProjection: loadedTeamManifest.promptProjection,
    },
    loadedPolicy,
    loadedTeamManifest.bodySections,
  );
  const teamPart = renderPromptPlan(
    buildPromptPlan(applyPromptProjection(buildPromptCatalog(teamSource), teamSource.promptProjection)),
    defaultRenderContext,
  );

  return [renderPart("Team Contract", teamPart), renderPart("Agent Contract", agentPart)]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, _requestedTools?: readonly string[]): string {
  const teamSource = buildTeamPromptSource(
    {
      id: agent.sourceTeam.manifest.id,
      name: agent.sourceTeam.manifest.name,
      promptProjection: agent.sourceTeam.policy.promptProjection,
    },
    agent.sourceTeam.policy,
  );
  const teamPart = renderPromptPlan(
    buildPromptPlan(applyPromptProjection(buildPromptCatalog(teamSource), teamSource.promptProjection)),
    defaultRenderContext,
  );
  const normalizedAgent = buildAgentPromptSourceWithOverrides(agent.sourceAgent, {
    collaborationValue: createCollaborationPromptValue(agent),
  });
  const agentPart = renderPromptPlan(
    buildPromptPlan(applyPromptProjection(buildPromptCatalog(normalizedAgent), normalizedAgent.promptProjection)),
    defaultRenderContext,
  );

  return [renderPart("Team Contract", teamPart), renderPart("Agent Contract", agentPart)]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}
