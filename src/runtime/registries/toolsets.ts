export interface ToolsetDefinition {
  id: string;
  description: string;
  requestedTools: string[];
  permissionRules: Array<{
    permission: string;
    action: "allow" | "deny" | "ask";
    pattern?: string;
  }>;
}

const TOOLSETS: Record<string, ToolsetDefinition> = {
  "repo-readonly": {
    id: "repo-readonly",
    description: "Read-only repository access.",
    requestedTools: ["read", "glob", "grep"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
      { permission: "bash", action: "deny" },
    ],
  },
  "repo-readwrite": {
    id: "repo-readwrite",
    description: "Read/write repository access with approval for mutations.",
    requestedTools: ["read", "glob", "grep", "edit", "write", "bash", "lsp_diagnostics"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "edit", action: "ask" },
      { permission: "write", action: "ask" },
      { permission: "bash", action: "ask" },
      { permission: "lsp_diagnostics", action: "allow" },
    ],
  },
  "web-research": {
    id: "web-research",
    description: "Read-only research access with web tools.",
    requestedTools: ["read", "glob", "grep", "webfetch", "websearch"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "webfetch", action: "allow" },
      { permission: "websearch", action: "allow" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
      { permission: "bash", action: "deny" },
    ],
  },
  "research-readonly": {
    id: "research-readonly",
    description: "Read-only research access for internal or external evidence gathering.",
    requestedTools: ["read", "glob", "grep", "webfetch", "websearch"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "webfetch", action: "allow" },
      { permission: "websearch", action: "allow" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
      { permission: "bash", action: "deny" },
    ],
  },
  "multimodal-readonly": {
    id: "multimodal-readonly",
    description: "Read-only multimodal analysis access.",
    requestedTools: ["read", "look_at"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "look_at", action: "allow" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
      { permission: "bash", action: "deny" },
    ],
  },
  "coding-team-default": {
    id: "coding-team-default",
    description: "Default coding-team access with controlled mutation tools.",
    requestedTools: ["read", "glob", "grep", "skill", "task", "edit", "write", "bash", "lsp_diagnostics"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "skill", action: "allow" },
      { permission: "task", action: "allow" },
      { permission: "edit", action: "ask" },
      { permission: "write", action: "ask" },
      { permission: "bash", action: "ask" },
      { permission: "lsp_diagnostics", action: "allow" },
    ],
  },
  "codebase-readwrite-direct": {
    id: "codebase-readwrite-direct",
    description: "Direct implementation access for execution roles.",
    requestedTools: ["read", "glob", "grep", "skill", "edit", "write", "bash", "todowrite", "lsp_diagnostics"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "skill", action: "allow" },
      { permission: "edit", action: "ask" },
      { permission: "write", action: "ask" },
      { permission: "bash", action: "ask" },
      { permission: "todowrite", action: "allow" },
      { permission: "lsp_diagnostics", action: "allow" },
    ],
  },
  "docs-github-history-readonly": {
    id: "docs-github-history-readonly",
    description: "Read-only docs, GitHub, and history research access.",
    requestedTools: ["read", "glob", "grep", "webfetch", "websearch"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "webfetch", action: "allow" },
      { permission: "websearch", action: "allow" },
      { permission: "bash", action: "deny" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
    ],
  },
  "internal-code-search-readonly": {
    id: "internal-code-search-readonly",
    description: "Read-only codebase search access.",
    requestedTools: ["read", "glob", "grep"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "bash", action: "deny" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
    ],
  },
  "orchestrator-qa": {
    id: "orchestrator-qa",
    description: "Review and QA access with no mutation tools.",
    requestedTools: ["read", "glob", "grep", "task"],
    permissionRules: [
      { permission: "read", action: "allow" },
      { permission: "glob", action: "allow" },
      { permission: "grep", action: "allow" },
      { permission: "task", action: "allow" },
      { permission: "edit", action: "deny" },
      { permission: "write", action: "deny" },
      { permission: "bash", action: "deny" },
    ],
  },
};

export function listToolsets(): ToolsetDefinition[] {
  return Object.values(TOOLSETS);
}

export function getToolset(toolsetId: string): ToolsetDefinition {
  const toolset = TOOLSETS[toolsetId];

  if (!toolset) {
    throw new Error(`Unknown toolset: ${toolsetId}`);
  }

  return toolset;
}
