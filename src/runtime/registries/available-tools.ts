import { listImplementedCrewBeePluginTools } from "./plugin-tools";

export interface AvailableToolDefinition {
  id: string;
  source: "host-provided" | "crewbee-plugin" | "default-placeholder";
}

export interface AvailableToolContext {
  tools: AvailableToolDefinition[];
  source: "host-provided" | "crewbee-plugin" | "merged" | "default-placeholder";
  hasExplicitTools: boolean;
}

function normalizeTool(tool: string | AvailableToolDefinition): AvailableToolDefinition {
  if (typeof tool === "string") {
    return { id: tool, source: "host-provided" };
  }

  return tool;
}

export function createAvailableToolContext(
  tools?: readonly (string | AvailableToolDefinition)[],
): AvailableToolContext {
  const hostTools = tools?.map(normalizeTool) ?? [];
  const pluginTools = listImplementedCrewBeePluginTools().map((tool) => ({
    id: tool.id,
    source: tool.source,
  }));

  const mergedTools = [...hostTools];

  for (const pluginTool of pluginTools) {
    if (!mergedTools.some((tool) => tool.id === pluginTool.id)) {
      mergedTools.push(pluginTool);
    }
  }

  if (mergedTools.length === 0) {
    // Framework-level fallback only: when the host has not provided tool metadata yet,
    // keep the model permissive and mark the source as a default placeholder instead of
    // hardcoding a specific OpenCode builtin tool list.
    return {
      tools: [],
      source: "default-placeholder",
      hasExplicitTools: false,
    };
  }

  const source = hostTools.length > 0 && pluginTools.length > 0
    ? "merged"
    : hostTools.length > 0
      ? "host-provided"
      : "crewbee-plugin";

  return {
    tools: mergedTools,
    source,
    hasExplicitTools: true,
  };
}

export function listAvailableTools(context?: AvailableToolContext): AvailableToolDefinition[] {
  return context?.tools ?? [];
}

export function isAvailableTool(toolId: string, context?: AvailableToolContext): boolean {
  if (!context || !context.hasExplicitTools) {
    return true;
  }

  return context.tools.some((tool) => tool.id === toolId);
}
