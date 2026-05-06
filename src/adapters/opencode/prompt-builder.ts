import type { LoadedProfileDocument } from "../../core";
import { attachMarkdownBodySections } from "../../loader/markdown-body-loader";
import { loadAgentProfile, loadTeamManifest, loadTeamPolicy } from "../../loader/profile-loader";
import { buildAgentPromptDocumentWithOverrides } from "../../normalize/build-agent-prompt-document";
import { buildTeamPromptDocument } from "../../normalize/build-team-prompt-document";
import { normalizeProfileDocument } from "../../normalize/normalize-document";
import { renderLoadedPromptDocument, renderNormalizedPromptDocument } from "../../render/prompt-document-renderer";
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

function renderPart(title: string, body: string): string | undefined {
  return body.trim().length > 0 ? `## ${title}\n\n${body}` : undefined;
}

export function createOpenCodePromptFromDocuments(input: {
  team: LoadedProfileDocument;
  agent: LoadedProfileDocument;
}): string {
  const teamPart = renderLoadedPromptDocument(input.team);
  const agentPart = renderLoadedPromptDocument(input.agent);

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
  const agentPart = renderNormalizedPromptDocument(normalizedAgent);

  const loadedPolicy = loadTeamPolicy(input.teamPolicyRaw);
  const teamDocument = buildTeamPromptDocument(
    {
      id: String(loadedTeamManifest.metadata.id),
      name: typeof loadedTeamManifest.metadata.name === "string" ? loadedTeamManifest.metadata.name : undefined,
      promptProjection: loadedTeamManifest.promptProjection,
    },
    loadedPolicy,
    loadedTeamManifest.bodySections,
  );
  const teamPart = renderNormalizedPromptDocument(teamDocument);

  return [renderPart("Team Contract", teamPart), renderPart("Agent Contract", agentPart)]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, _requestedTools?: readonly string[]): string {
  const teamDocument = buildTeamPromptDocument(
    {
      id: agent.sourceTeam.manifest.id,
      name: agent.sourceTeam.manifest.name,
      promptProjection: agent.sourceTeam.policy.promptProjection,
    },
    agent.sourceTeam.policy,
  );
  const teamPart = renderNormalizedPromptDocument(teamDocument);
  const normalizedAgent = buildAgentPromptDocumentWithOverrides(agent.sourceAgent, {
    collaborationValue: createCollaborationPromptValue(agent),
  });
  const agentPart = renderNormalizedPromptDocument(normalizedAgent);

  return [renderPart("Team Contract", teamPart), renderPart("Agent Contract", agentPart)]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}
