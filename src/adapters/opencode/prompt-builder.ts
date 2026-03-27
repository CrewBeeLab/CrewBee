import type {
  AgentProfileSpec,
  LoadedProfileDocument,
  PromptProjectionSpec,
  TeamManifest,
} from "../../core";
import { buildPromptCatalog } from "../../catalog/build-prompt-catalog";
import { loadProfileDocument } from "../../loader/profile-loader";
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

function normalizeRuntimeProjectionPath(path: string): string {
  return ["id", "name", "kind", "version", "status", "owner", "tags", "archetype"].includes(path)
    ? `metadata.${path}`
    : path;
}

function normalizeRuntimePromptProjection(
  projection: PromptProjectionSpec | undefined,
): PromptProjectionSpec | undefined {
  if (!projection) {
    return undefined;
  }

  const include = projection.include?.map(normalizeRuntimeProjectionPath);
  const exclude = projection.exclude?.map(normalizeRuntimeProjectionPath);
  const labels = projection.labels
    ? Object.fromEntries(
        Object.entries(projection.labels).map(([key, value]) => [normalizeRuntimeProjectionPath(key), value]),
      )
    : undefined;

  return {
    ...(include ? { include } : {}),
    ...(exclude ? { exclude } : {}),
    ...(labels ? { labels } : {}),
  };
}

function createRawTeamPromptRecord(manifest: TeamManifest): UnknownRecord {
  const raw = toSnakeCaseValue(manifest) as UnknownRecord;
  if (isRecord(raw.prompt_projection)) {
    raw.prompt_projection = normalizeRuntimePromptProjection(raw.prompt_projection as PromptProjectionSpec);
  }
  return raw;
}

function createRawAgentPromptRecord(agent: AgentProfileSpec): UnknownRecord {
  const raw = toSnakeCaseValue(agent) as UnknownRecord;
  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  const promptProjection = normalizeRuntimePromptProjection(raw.prompt_projection as PromptProjectionSpec | undefined);

  return {
    ...metadata,
    ...Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "metadata" && key !== "prompt_projection")),
    ...(promptProjection ? { prompt_projection: promptProjection } : {}),
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

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, _requestedTools?: readonly string[]): string {
  return createOpenCodePromptFromDocuments({
    team: loadProfileDocument(createRawTeamPromptRecord(agent.sourceTeam.manifest), "team"),
    agent: loadProfileDocument(createRawAgentPromptRecord(agent.sourceAgent), "agent"),
  });
}
