import type { OpenCodeAgentConfig } from "../projection";

import { toV2PermissionRules, type V2PermissionRule } from "./permissions";

/**
 * Minimal structural view of the V2 agent record that CrewBee needs to write.
 *
 * OpenCode brands these fields (`Agent.ID`, `Agent.Name`, `Model.ID`, ...), so call sites cast the
 * editor's agent object to this shape instead of fighting the brands.
 */
export interface OpenCodeV2AgentDefinition {
  id: string;
  name: string;
  description?: string;
  mode: "primary" | "subagent" | "all";
  hidden: boolean;
  system?: string;
  model?: { providerID: string; id: string; variant?: string };
  permissions: V2PermissionRule[];
}

export interface MutableAgentRecord extends OpenCodeV2AgentDefinition {
  request?: {
    settings?: Record<string, unknown>;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  color?: string;
  steps?: number;
}

export function createV2AgentDefinition(agent: OpenCodeAgentConfig): OpenCodeV2AgentDefinition {
  const resolved = agent.resolvedModel;

  return {
    id: agent.configKey,
    name: agent.configKey,
    description: agent.description,
    mode: agent.mode === "primary" ? "primary" : "subagent",
    hidden: agent.hidden,
    system: agent.prompt,
    model: resolved
      ? {
        providerID: resolved.providerID,
        id: resolved.modelID,
        ...(resolved.variant ? { variant: resolved.variant } : {}),
      }
      : undefined,
    permissions: toV2PermissionRules(agent.permission),
  };
}

export function applyV2AgentDefinition(target: MutableAgentRecord, definition: OpenCodeV2AgentDefinition): void {
  target.name = definition.name;
  target.description = definition.description;
  target.mode = definition.mode;
  target.hidden = definition.hidden;
  target.system = definition.system;
  target.permissions = definition.permissions;

  if (definition.model) {
    target.model = definition.model;
  } else {
    target.model = undefined;
  }
}

/**
 * Host agents owned by OpenCode: CrewBee hides them (and demotes them to subagents) while a
 * CrewBee Agent Team owns the session, mirroring the V1 `disable: true` + `mode: "subagent"` patch.
 */
export const OPEN_CODE_HOST_AGENT_KEYS = ["build", "plan", "general", "explore", "scout"] as const;
