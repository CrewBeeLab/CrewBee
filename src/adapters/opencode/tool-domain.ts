import {
  listCrewBeePluginTools,
  listImplementedCrewBeePluginTools,
  type CrewBeePluginToolDefinition,
} from "../../runtime/registries/plugin-tools";

export interface OpenCodeToolDomainPlan {
  hostId: "opencode";
  reservedTools: CrewBeePluginToolDefinition[];
  implementedTools: CrewBeePluginToolDefinition[];
  toolInjectionMode: "reserved-only" | "inject-implemented-tools";
}

export function createOpenCodeToolDomainPlan(): OpenCodeToolDomainPlan {
  const implementedTools = listImplementedCrewBeePluginTools().filter((tool) => tool.hostTargets.includes("opencode"));
  const reservedTools = listCrewBeePluginTools().filter((tool) => tool.hostTargets.includes("opencode"));

  return {
    hostId: "opencode",
    reservedTools,
    implementedTools,
    toolInjectionMode: implementedTools.length > 0 ? "inject-implemented-tools" : "reserved-only",
  };
}
