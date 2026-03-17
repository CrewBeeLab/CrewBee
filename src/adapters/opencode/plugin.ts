import type { Plugin } from "@opencode-ai/plugin";

import { loadDefaultTeamLibrary, validateTeamLibrary, type TeamValidationIssue } from "../../agent-teams";
import { createSessionRuntimeBinding, type SessionRuntimeBinding } from "../../runtime";

import {
  createOpenCodeBootstrap,
  type OpenCodeBootstrapOutput,
} from "./bootstrap";
import type { OpenCodeConfigLike } from "./config-merge";
import {
  createProjectedAgentAliasIndex,
  createProjectedAgentTaskAliasHelpLines,
  resolveProjectedAgentAlias,
  resolveProjectedAgentSelection,
} from "./projection";

const DEFAULT_MODE = "single-executor" as const;

function deduplicateTaskDescription(description: string): string {
  const seen = new Set<string>();

  return description
    .split("\n")
    .filter((line) => {
      if (!line.startsWith("- ")) {
        return true;
      }

      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .join("\n");
}

function getDefaultAgent(boot: OpenCodeBootstrapOutput): string | undefined {
  return boot.mergedConfig?.default_agent ?? boot.configPatch.defaultAgent;
}

function getConfig(cfg: { agent?: Record<string, unknown> }): OpenCodeConfigLike {
  return cfg as OpenCodeConfigLike;
}

export const OpenCodeCrewBeePlugin: Plugin = async (ctx) => {
  const teamLibrary = loadDefaultTeamLibrary(ctx.worktree);
  const issues = validateTeamLibrary(teamLibrary);
  const errors = issues.filter((issue: TeamValidationIssue) => issue.level === "error");

  if (errors.length > 0) {
    throw new Error(errors.map((issue: TeamValidationIssue) => issue.message).join("\n"));
  }

  await Promise.all(
    issues.map((issue: TeamValidationIssue) => ctx.client.app.log({
      body: {
        service: "crewbee",
        level: issue.level === "warning" ? "warn" : "error",
        message: issue.message,
        extra: issue.filePath ? { filePath: issue.filePath } : undefined,
      },
    })),
  );

  let boot = createOpenCodeBootstrap({
    teamLibrary,
    defaults: {
      defaultMode: DEFAULT_MODE,
    },
  });
  let aliasIndex = createProjectedAgentAliasIndex(boot.projectedAgents);
  const bindings = new Map<string, SessionRuntimeBinding>();

  return {
    config: async (cfg) => {
      const current = getConfig(cfg);
      const next = createOpenCodeBootstrap({
        teamLibrary,
        defaults: {
          defaultMode: DEFAULT_MODE,
        },
        existingConfig: current,
        existingDefaultAgent: typeof current.default_agent === "string" ? current.default_agent : undefined,
      });

      boot = next;
      aliasIndex = createProjectedAgentAliasIndex(next.projectedAgents);
      cfg.agent = (next.mergedConfig?.agent ?? next.configPatch.agent) as typeof cfg.agent;

      if (next.mergedConfig?.default_agent) {
        current.default_agent = next.mergedConfig.default_agent;
      }

      if (!next.mergeResult) {
        return;
      }

      await ctx.client.app.log({
        body: {
          service: "crewbee",
          level: "info",
          message: "CrewBee projected OpenCode agents into config",
          extra: {
            inserted: next.mergeResult.insertedAgentKeys,
            updated: next.mergeResult.updatedAgentKeys,
            skipped: next.mergeResult.skippedAgentKeys,
          },
        },
      });
    },
    "chat.message": async (input) => {
      const selected = input.agent ?? getDefaultAgent(boot);

      if (!selected) {
        return;
      }

      const agent = resolveProjectedAgentSelection(boot.projectedAgents, {
        configKey: selected,
        publicName: selected,
      });

      if (!agent) {
        return;
      }

      bindings.set(input.sessionID, createSessionRuntimeBinding({
        projection: boot.projection,
        sessionID: input.sessionID,
        teamId: agent.teamId,
        sourceAgentId: agent.sourceAgentId,
        mode: DEFAULT_MODE,
        source: input.agent ? "host-agent-selection" : "plugin-default",
      }));
    },
    "tool.definition": async (input, output) => {
      if (input.toolID !== "task") {
        return;
      }

      const helpLines = createProjectedAgentTaskAliasHelpLines(boot.projectedAgents);

      if (helpLines.length === 0) {
        return;
      }

      output.description = deduplicateTaskDescription(output.description);
      output.description = [
        output.description,
        "",
        "CrewBee subagent aliases:",
        ...helpLines,
        "",
        "When delegating inside CrewBee, prefer the CrewBee source-agent alias shown on each line.",
      ].join("\n");
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "task") {
        return;
      }

      if (!bindings.has(input.sessionID)) {
        return;
      }

      if (typeof output.args !== "object" || output.args === null) {
        return;
      }

      const subagentType = "subagent_type" in output.args ? output.args.subagent_type : undefined;

      if (typeof subagentType !== "string") {
        return;
      }

      const resolved = resolveProjectedAgentAlias(aliasIndex, subagentType);

      if (!resolved) {
        return;
      }

      output.args.subagent_type = resolved.agent.configKey;
    },
    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) {
        return;
      }

      const binding = bindings.get(input.sessionID);

      if (!binding) {
        return;
      }

      output.system.push([
        "CrewBee runtime binding:",
        `- Team: ${binding.teamId}`,
        `- Entry Agent: ${binding.selectedAgentId}`,
        `- Active Owner: ${binding.activeOwnerId}`,
        `- Mode: ${binding.mode}`,
      ].join("\n"));
    },
  };
};

export default OpenCodeCrewBeePlugin;
