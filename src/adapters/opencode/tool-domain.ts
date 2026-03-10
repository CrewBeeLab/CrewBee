import {
  listAgentScrollPluginTools,
  listImplementedAgentScrollPluginTools,
  type AgentScrollPluginToolDefinition,
} from "../../runtime/registries/plugin-tools";

export interface OpenCodeToolDomainPlan {
  hostId: "opencode";
  reservedTools: AgentScrollPluginToolDefinition[];
  implementedTools: AgentScrollPluginToolDefinition[];
  toolInjectionMode: "reserved-only" | "inject-implemented-tools";
}

export function createOpenCodeToolDomainPlan(): OpenCodeToolDomainPlan {
  const implementedTools = listImplementedAgentScrollPluginTools().filter((tool) => tool.hostTargets.includes("opencode"));
  const reservedTools = listAgentScrollPluginTools().filter((tool) => tool.hostTargets.includes("opencode"));

  return {
    hostId: "opencode",
    reservedTools,
    implementedTools,
    toolInjectionMode: implementedTools.length > 0 ? "inject-implemented-tools" : "reserved-only",
  };
}
