export type CrewBeePluginToolStatus = "reserved-placeholder" | "implemented";

export type CrewBeePluginToolVisibility = "agent-addressable" | "internal-only";

export interface CrewBeePluginToolDefinition {
  id: string;
  source: "crewbee-plugin";
  status: CrewBeePluginToolStatus;
  visibility: CrewBeePluginToolVisibility;
  description: string;
  hostTargets: string[];
}

const CREWBEE_PLUGIN_TOOLS: Record<string, CrewBeePluginToolDefinition> = {
  delegate_task: {
    id: "delegate_task",
    source: "crewbee-plugin",
    status: "implemented",
    visibility: "agent-addressable",
    description: "Delegate work to a CrewBee team member with foreground or background execution.",
    hostTargets: ["opencode"],
  },
  delegate_status: {
    id: "delegate_status",
    source: "crewbee-plugin",
    status: "implemented",
    visibility: "agent-addressable",
    description: "Query the status of a CrewBee background delegation.",
    hostTargets: ["opencode"],
  },
  delegate_cancel: {
    id: "delegate_cancel",
    source: "crewbee-plugin",
    status: "implemented",
    visibility: "agent-addressable",
    description: "Cancel a CrewBee background delegation.",
    hostTargets: ["opencode"],
  },
};

export function listCrewBeePluginTools(): CrewBeePluginToolDefinition[] {
  return Object.values(CREWBEE_PLUGIN_TOOLS);
}

export function listImplementedCrewBeePluginTools(): CrewBeePluginToolDefinition[] {
  return listCrewBeePluginTools().filter((tool) => tool.status === "implemented");
}

export function getCrewBeePluginTool(toolId: string): CrewBeePluginToolDefinition | undefined {
  return CREWBEE_PLUGIN_TOOLS[toolId];
}
