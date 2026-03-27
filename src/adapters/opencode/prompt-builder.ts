import type { AgentProfileSpec, LoadedProfileDocument, TeamManifest, TeamPolicySpec } from "../../core";
import { buildPromptCatalog } from "../../catalog/build-prompt-catalog";
import { attachMarkdownBodySections } from "../../loader/markdown-body-loader";
import { loadAgentProfile, loadTeamManifest, loadTeamPolicy } from "../../loader/profile-loader";
import { buildTeamPromptSource } from "../../normalize/build-team-prompt-source";
import { normalizeProfileDocument } from "../../normalize/normalize-document";
import { buildPromptPlan } from "../../plan/build-prompt-plan";
import { applyPromptProjection } from "../../projection/apply-prompt-projection";
import { defaultRenderContext, renderPromptPlan } from "../../render/structural-renderer";
import type { ProjectedAgent } from "../../runtime";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function toSnakeCaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toSnakeCaseValue(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [toSnakeCase(key), toSnakeCaseValue(entry)]),
  );
}

function orderedEntries(record: UnknownRecord): Array<[string, unknown]> {
  return Object.entries(record);
}

function createRawTeamManifestRecord(manifest: TeamManifest): UnknownRecord {
  return {
    id: manifest.id,
    name: manifest.name,
  };
}

function createRawAgentPromptRecord(agent: AgentProfileSpec): UnknownRecord {
  const metadata = toSnakeCaseValue(agent.metadata) as UnknownRecord;
  const extraSections = isRecord(agent.extraSections) ? (toSnakeCaseValue(agent.extraSections) as UnknownRecord) : {};
  const raw: UnknownRecord = {
    ...metadata,
    persona_core: toSnakeCaseValue(agent.personaCore),
    responsibility_core: toSnakeCaseValue(agent.responsibilityCore),
    core_principle: agent.corePrinciple ? toSnakeCaseValue(agent.corePrinciple) : undefined,
    scope_control: agent.scopeControl ? toSnakeCaseValue(agent.scopeControl) : undefined,
    ambiguity_policy: agent.ambiguityPolicy ? toSnakeCaseValue(agent.ambiguityPolicy) : undefined,
    support_triggers: agent.supportTriggers ? toSnakeCaseValue(agent.supportTriggers) : undefined,
    repository_assessment: agent.repositoryAssessment ? toSnakeCaseValue(agent.repositoryAssessment) : undefined,
    collaboration: toSnakeCaseValue(agent.collaboration),
    task_triage: agent.taskTriage ? toSnakeCaseValue(agent.taskTriage) : undefined,
    delegation_review: agent.delegationReview ? toSnakeCaseValue(agent.delegationReview) : undefined,
    todo_discipline: agent.todoDiscipline ? toSnakeCaseValue(agent.todoDiscipline) : undefined,
    completion_gate: agent.completionGate ? toSnakeCaseValue(agent.completionGate) : undefined,
    failure_recovery: agent.failureRecovery ? toSnakeCaseValue(agent.failureRecovery) : undefined,
    operations: agent.operations ? toSnakeCaseValue(agent.operations) : undefined,
    output_contract: toSnakeCaseValue(agent.outputContract),
    templates: agent.templates ? toSnakeCaseValue(agent.templates) : undefined,
    guardrails: agent.guardrails ? toSnakeCaseValue(agent.guardrails) : undefined,
    heuristics: agent.heuristics,
    anti_patterns: agent.antiPatterns,
    tool_skill_strategy: agent.toolSkillStrategy ? toSnakeCaseValue(agent.toolSkillStrategy) : undefined,
    examples: agent.examples ? toSnakeCaseValue(agent.examples) : undefined,
    ...extraSections,
  };

  return {
    ...Object.fromEntries(orderedEntries(raw).filter(([, value]) => value !== undefined)),
    ...(agent.promptProjection ? { prompt_projection: toSnakeCaseValue(agent.promptProjection) } : {}),
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
  const loadedTeamManifest = loadTeamManifest(input.teamManifestRaw);
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
  const loadedAgent = loadAgentProfile(createRawAgentPromptRecord(agent.sourceAgent));
  const normalizedAgent = normalizeProfileDocument(loadedAgent);
  const agentPart = renderPromptPlan(
    buildPromptPlan(applyPromptProjection(buildPromptCatalog(normalizedAgent), normalizedAgent.promptProjection)),
    defaultRenderContext,
  );

  return [renderPart("Team Contract", teamPart), renderPart("Agent Contract", agentPart)]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}
