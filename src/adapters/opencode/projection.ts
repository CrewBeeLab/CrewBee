import type { CatalogAgentProjection, CatalogProjection } from "../../runtime";

export type OpenCodeProjectedAgentMode = "primary" | "subagent";

export interface OpenCodeProjectedAgentConfig {
  configKey: string;
  publicName: string;
  teamId: string;
  sourceAgentId: string;
  mode: OpenCodeProjectedAgentMode;
  hidden: boolean;
  description: string;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createOpenCodePublicAgentName(agent: CatalogAgentProjection): string {
  return `[${agent.teamName}]${agent.surfaceLabel}`;
}

export function createOpenCodeConfigKey(agent: CatalogAgentProjection): string {
  return `agentscroll.${sanitizeSegment(agent.teamId)}.${sanitizeSegment(agent.surfaceLabel)}`;
}

export function projectCatalogAgentToOpenCode(agent: CatalogAgentProjection): OpenCodeProjectedAgentConfig {
  return {
    configKey: createOpenCodeConfigKey(agent),
    publicName: createOpenCodePublicAgentName(agent),
    teamId: agent.teamId,
    sourceAgentId: agent.sourceAgentId,
    mode: agent.exposure === "user-selectable" ? "primary" : "subagent",
    hidden: agent.exposure !== "user-selectable",
    description: agent.description,
  };
}

export function projectCatalogToOpenCodeAgents(catalog: CatalogProjection): OpenCodeProjectedAgentConfig[] {
  return catalog.agents.map((agent) => projectCatalogAgentToOpenCode(agent));
}
