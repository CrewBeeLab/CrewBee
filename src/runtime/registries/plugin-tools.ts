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
  "crewbee.team-state": {
    id: "crewbee.team-state",
    source: "crewbee-plugin",
    status: "reserved-placeholder",
    visibility: "agent-addressable",
    description: "Reserved placeholder for Team runtime state read/write helpers.",
    hostTargets: ["opencode"],
  },
  "crewbee.session-binding": {
    id: "crewbee.session-binding",
    source: "crewbee-plugin",
    status: "reserved-placeholder",
    visibility: "internal-only",
    description: "Reserved placeholder for session binding synchronization helpers.",
    hostTargets: ["opencode"],
  },
  "crewbee.team-handoff": {
    id: "crewbee.team-handoff",
    source: "crewbee-plugin",
    status: "reserved-placeholder",
    visibility: "agent-addressable",
    description: "Reserved placeholder for explicit Team handoff and delegation helpers.",
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
