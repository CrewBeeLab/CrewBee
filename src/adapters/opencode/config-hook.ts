import type { PluginInput } from "@opencode-ai/plugin";

import { validateTeamLibrary, type TeamValidationIssue } from "../../agent-teams";
import type { TeamLibrary } from "../../core";

import { createOpenCodeBootstrap, type OpenCodeBootstrapOutput } from "./bootstrap";
import type { OpenCodeConfigLike } from "./config-merge";
import { logCrewBee } from "./logging";
import { createProjectedAgentAliasIndex, type OpenCodeAgentAliasEntry } from "./projection";

const DEFAULT_MODE = "single-executor" as const;

function summarizeProjectedAgents(boot: OpenCodeBootstrapOutput): Array<{
  configKey: string;
  hidden: boolean;
  model?: string;
}> {
  return boot.projectedAgents.map((agent) => ({
    configKey: agent.configKey,
    hidden: agent.hidden,
    model: agent.resolvedModel ? `${agent.resolvedModel.providerID}/${agent.resolvedModel.modelID}` : undefined,
  }));
}

function getConfig(cfg: { agent?: Record<string, unknown> }): OpenCodeConfigLike {
  return cfg as OpenCodeConfigLike;
}

export async function validateAndLogTeamLibrary(ctx: PluginInput, teamLibrary: TeamLibrary): Promise<void> {
  const issues = validateTeamLibrary(teamLibrary);
  const errors = issues.filter((issue: TeamValidationIssue) => issue.level === "error" && issue.blocking !== false);
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
}

export function createInitialBootstrap(teamLibrary: TeamLibrary): {
  boot: OpenCodeBootstrapOutput;
  aliasIndex: Map<string, OpenCodeAgentAliasEntry>;
} {
  const boot = createOpenCodeBootstrap({
    teamLibrary,
    defaults: { defaultMode: DEFAULT_MODE },
  });
  return {
    boot,
    aliasIndex: createProjectedAgentAliasIndex(boot.projectedAgents),
  };
}

export function createConfigHook(input: {
  ctx: PluginInput;
  teamLibrary: TeamLibrary;
  getBoot(): OpenCodeBootstrapOutput;
  setBoot(boot: OpenCodeBootstrapOutput): void;
  setAliasIndex(index: Map<string, OpenCodeAgentAliasEntry>): void;
}) {
  return async (cfg: { agent?: Record<string, unknown> }) => {
    const current = getConfig(cfg);
    const next = createOpenCodeBootstrap({
      teamLibrary: input.teamLibrary,
      defaults: { defaultMode: DEFAULT_MODE },
      existingConfig: current,
      existingDefaultAgent: typeof current.default_agent === "string" ? current.default_agent : undefined,
    });

    input.setBoot(next);
    input.setAliasIndex(createProjectedAgentAliasIndex(next.projectedAgents));

    await logCrewBee(input.ctx, "CrewBee config hook rebuilding projected agents", {
      projectedAgentCount: next.projectedAgents.length,
      visibleAgentCount: next.projectedAgents.filter((agent) => !agent.hidden).length,
      defaultAgent: next.mergedConfig?.default_agent ?? next.configPatch.defaultAgent,
      projectedAgents: summarizeProjectedAgents(next),
    });

    cfg.agent = (next.mergedConfig?.agent ?? next.configPatch.agent) as typeof cfg.agent;

    if (next.mergedConfig?.default_agent) {
      current.default_agent = next.mergedConfig.default_agent;
    }

    if (!next.mergeResult) {
      return;
    }

    await logCrewBee(input.ctx, "CrewBee projected OpenCode agents into config", {
      inserted: next.mergeResult.insertedAgentKeys,
      updated: next.mergeResult.updatedAgentKeys,
      skipped: next.mergeResult.skippedAgentKeys,
      defaultAgent: next.mergedConfig?.default_agent ?? next.configPatch.defaultAgent,
      projectedAgentCount: next.projectedAgents.length,
      visibleAgentCount: next.projectedAgents.filter((agent) => !agent.hidden).length,
      projectedAgents: summarizeProjectedAgents(next),
    });
  };
}
