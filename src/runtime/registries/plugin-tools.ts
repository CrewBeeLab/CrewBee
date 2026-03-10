export type AgentScrollPluginToolStatus = "reserved-placeholder" | "implemented";

export type AgentScrollPluginToolVisibility = "agent-addressable" | "internal-only";

export interface AgentScrollPluginToolDefinition {
  id: string;
  source: "agentscroll-plugin";
  status: AgentScrollPluginToolStatus;
  visibility: AgentScrollPluginToolVisibility;
  description: string;
  hostTargets: string[];
}

const AGENTSCROLL_PLUGIN_TOOLS: Record<string, AgentScrollPluginToolDefinition> = {
  "agentscroll.team-state": {
    id: "agentscroll.team-state",
    source: "agentscroll-plugin",
    status: "reserved-placeholder",
    visibility: "agent-addressable",
    description: "Reserved placeholder for Team runtime state read/write helpers.",
    hostTargets: ["opencode"],
  },
  "agentscroll.session-binding": {
    id: "agentscroll.session-binding",
    source: "agentscroll-plugin",
    status: "reserved-placeholder",
    visibility: "internal-only",
    description: "Reserved placeholder for session binding synchronization helpers.",
    hostTargets: ["opencode"],
  },
  "agentscroll.team-handoff": {
    id: "agentscroll.team-handoff",
    source: "agentscroll-plugin",
    status: "reserved-placeholder",
    visibility: "agent-addressable",
    description: "Reserved placeholder for explicit Team handoff and delegation helpers.",
    hostTargets: ["opencode"],
  },
};

export function listAgentScrollPluginTools(): AgentScrollPluginToolDefinition[] {
  return Object.values(AGENTSCROLL_PLUGIN_TOOLS);
}

export function listImplementedAgentScrollPluginTools(): AgentScrollPluginToolDefinition[] {
  return listAgentScrollPluginTools().filter((tool) => tool.status === "implemented");
}

export function getAgentScrollPluginTool(toolId: string): AgentScrollPluginToolDefinition | undefined {
  return AGENTSCROLL_PLUGIN_TOOLS[toolId];
}
