export interface AvailableToolDefinition {
  id: string;
  source: "opencode-builtin" | "agentscroll-plugin";
}

const OPENCODE_BUILTIN_TOOLS: AvailableToolDefinition[] = [
  { id: "question", source: "opencode-builtin" },
  { id: "bash", source: "opencode-builtin" },
  { id: "read", source: "opencode-builtin" },
  { id: "glob", source: "opencode-builtin" },
  { id: "grep", source: "opencode-builtin" },
  { id: "edit", source: "opencode-builtin" },
  { id: "write", source: "opencode-builtin" },
  { id: "task", source: "opencode-builtin" },
  { id: "webfetch", source: "opencode-builtin" },
  { id: "todowrite", source: "opencode-builtin" },
  { id: "websearch", source: "opencode-builtin" },
  { id: "codesearch", source: "opencode-builtin" },
  { id: "skill", source: "opencode-builtin" },
  { id: "apply_patch", source: "opencode-builtin" },
  { id: "lsp_diagnostics", source: "opencode-builtin" },
  { id: "look_at", source: "opencode-builtin" },
];

const AGENTSCROLL_PLUGIN_TOOLS: AvailableToolDefinition[] = [];

export function listAvailableTools(): AvailableToolDefinition[] {
  return [...OPENCODE_BUILTIN_TOOLS, ...AGENTSCROLL_PLUGIN_TOOLS];
}

export function isAvailableTool(toolId: string): boolean {
  return listAvailableTools().some((tool) => tool.id === toolId);
}
