import test from "node:test";
import assert from "node:assert/strict";

import { createChatMessageHook, createOpenCodeBootstrap } from "../../dist/src/adapters/opencode/index.js";
import { OpenCodeCrewBeePlugin } from "../../dist/src/adapters/opencode/plugin.js";
import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/index.js";

function createPluginInput(options = {}) {
  return {
    client: {
      app: {
        log: async () => {},
      },
      config: options.availableModels
        ? {
          providers: async () => ({
            providers: Object.values(options.availableModels.reduce((acc, model) => {
              const separator = model.indexOf("/");
              const providerID = model.slice(0, separator);
              const modelID = model.slice(separator + 1);
              acc[providerID] ??= { id: providerID, models: {} };
              acc[providerID].models[modelID] = { id: modelID, name: modelID };
              return acc;
            }, {})),
          }),
        }
        : undefined,
    },
    project: {
      id: "test-project",
      directory: process.cwd(),
      worktree: process.cwd(),
    },
    directory: process.cwd(),
    worktree: process.cwd(),
    $() {
      throw new Error("Shell access is not available in tests.");
    },
  };
}

test("CrewBee accepts canonical task target ids directly", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    {
      sessionID: "ses-test-1",
      agent: "coding-leader",
    },
    {
      message: { role: "user", parts: [] },
      parts: [],
    },
  );

  const output = {
    args: {
      subagent_type: "coding-executor",
    },
  };

  await plugin["tool.execute.before"]?.(
    {
      tool: "task",
      sessionID: "ses-test-1",
      callID: "call-test-1",
    },
    output,
  );

  assert.equal(output.args.subagent_type, "coding-executor");
});

test("CrewBee projects canonical config keys and display names", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  assert.deepEqual(
    Object.keys(config.agent).slice(0, 3),
    ["coding-leader", "coding-coordination-leader", "coding-executor"],
  );
  assert.equal(config.agent["coding-leader"].name, "coding-leader");
  assert.equal(config.agent["coding-executor"].name, "coding-executor");
  assert.equal(config.agent["coding-coordination-leader"].name, "coding-coordination-leader");
  assert.equal(config.agent["[CodingTeam]leader"], undefined);
});

test("CrewBee disables host built-in agents while Team agents own execution", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  assert.equal(config.agent.build.disable, true);
  assert.equal(config.agent.plan.disable, true);
  assert.equal(config.agent.general.disable, true);
  assert.equal(config.agent.explore.disable, true);
  assert.equal(config.agent.scout.disable, true);
});

test("CrewBee leaves task tool definition callable for CrewBee task override", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const output = {
    description: "CrewBee task tool",
    parameters: {
      type: "object",
      properties: {
        subagent_type: {
          type: "string",
          description: "CrewBee agent",
        },
      },
    },
  };

  await plugin["tool.definition"]?.({ toolID: "task" }, output);

  assert.equal(output.description, "CrewBee task tool");
  assert.equal(output.parameters.properties.subagent_type.description, "CrewBee agent");
});

test("CrewBee config hook force-overwrites a foreign default agent", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = {
    agent: {},
    default_agent: "foreign.plugin.agent",
  };

  await plugin.config?.(config);

  assert.equal(config.default_agent, "coding-leader");
});

test("CrewBee projects CodingTeam executor edit/write permissions as allow by default", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  assert.equal(config.agent["coding-leader"].permission.bash["*"], "allow");
  assert.equal(config.agent["coding-executor"].permission.bash["*"], "allow");
  assert.equal(config.agent["coding-executor"].permission.edit["*"], "allow");
  assert.equal(config.agent["coding-coordination-leader"].permission.bash["*"], "allow");
});

test("CrewBee reads OpenCode configured provider models before projecting agent models", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput({ availableModels: ["openai/gpt-5.4-mini"] }));
  const config = { agent: {} };

  await plugin.config?.(config);

  assert.equal(config.agent["coding-codebase-explorer"].model, "openai/gpt-5.4-mini");
  assert.equal(config.agent["coding-reviewer"].model, undefined);
  assert.equal(config.agent["coding-multimodal-looker"].model, undefined);
});

test("CrewBee exposes task as the CrewBee delegation tool with Team-scoped targets", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  const leader = config.agent["coding-leader"];
  const coordinationLeader = config.agent["coding-coordination-leader"];
  const reviewer = config.agent["coding-reviewer"];

  assert.equal(leader.permission.task["*"], "deny");
  assert.equal(leader.permission.task["coding-reviewer"], "allow");
  assert.equal(leader.permission.task["coding-codebase-explorer"], "allow");
  assert.equal(leader.permission.task["general"] ?? "deny", "deny");
  assert.equal(leader.tools, undefined);
  assert.equal(leader.permission.delegate_task, undefined);
  assert.equal(coordinationLeader.permission.task["*"], "deny");
  assert.equal(coordinationLeader.permission.task["coding-executor"], "allow");
  assert.equal(coordinationLeader.permission.delegate_task, undefined);
  assert.equal(reviewer.permission.task?.["*"] ?? "deny", "deny");
  assert.equal(reviewer.permission.delegate_task, undefined);
  assert.ok(plugin.tool.task);
  assert.equal(plugin.tool.delegate_task, undefined);
  assert.ok(plugin.tool.task.args.subagent_type);
  assert.ok(plugin.tool.task.args.task_id);
  assert.ok(plugin.tool.task.args.run_in_background);
  assert.equal(plugin.tool.task.args.agent, undefined);
  assert.equal(plugin.tool.task.args.session_id, undefined);
});

test("CrewBee upgrades web-researcher prompt and runtime for librarian-style research", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  const agent = config.agent["coding-web-researcher"];

  assert.equal(agent.permission.bash["*"], "allow");
  assert.match(agent.prompt, /### Date Awareness/);
  assert.match(agent.prompt, /### Documentation Discovery/);
  assert.match(agent.prompt, /### Evidence Policy/);
  assert.match(agent.prompt, /### Output Policy/);
  assert.match(agent.prompt, /\*\*版本 \/ 范围\*\*/);
  assert.doesNotMatch(agent.prompt, /需要回答“如何使用某个库\/框架”“最佳实践是什么”这类概念性问题/);
});

test("CrewBee upgrades reviewer prompt and runtime for blocker-oriented approval reviews", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  const agent = config.agent["coding-reviewer"];

  assert.equal(agent.permission.lsp["*"], "allow");
  assert.equal(agent.permission.edit["*"], "deny");
  assert.equal(agent.permission.bash["*"], "deny");
  assert.match(agent.prompt, /### Input Validation/);
  assert.match(agent.prompt, /### Review Target Policy/);
  assert.match(agent.prompt, /### Approval Bias/);
  assert.match(agent.prompt, /### Blocking Threshold/);
  assert.match(agent.prompt, /\*\*\[OKAY\]\*\* 或 \*\*\[REJECT\]\*\*/);
  assert.doesNotMatch(agent.prompt, /计划生成后，需要判断该计划是否已经可以交给执行者推进/);
});

test("CrewBee upgrades principal-advisor prompt and runtime for oracle-style consulting", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  const agent = config.agent["coding-principal-advisor"];

  assert.equal(agent.permission.task["*"], "deny");
  assert.equal(agent.permission.task["coding-codebase-explorer"], "allow");
  assert.equal(agent.tools, undefined);
  assert.equal(agent.permission.edit["*"], "deny");
  assert.equal(agent.permission.write?.["*"] ?? "deny", "deny");
  assert.equal(agent.permission.bash["*"], "deny");
  assert.match(agent.prompt, /### Scope Control/);
  assert.match(agent.prompt, /### Ambiguity Policy/);
  assert.match(agent.prompt, /### Recommendation Policy/);
  assert.match(agent.prompt, /### High Risk Self Check/);
  assert.match(agent.prompt, /### Tool Use Policy/);
  assert.match(agent.prompt, /\*\*结论\*\*：<2-3 句主建议>/);
  assert.doesNotMatch(agent.prompt, /### Metadata/);
  assert.doesNotMatch(agent.prompt, /Good fit/);
});

test("CrewBee leaves canonical task ids unchanged", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    {
      sessionID: "ses-test-2",
      agent: "coding-leader",
    },
    {
      message: { role: "user", parts: [] },
      parts: [],
    },
  );

  const output = {
    args: {
      subagent_type: "coding-executor",
    },
  };

  await plugin["tool.execute.before"]?.(
    {
      tool: "task",
      sessionID: "ses-test-2",
      callID: "call-test-2",
    },
    output,
  );

  assert.equal(output.args.subagent_type, "coding-executor");
});

test("CrewBee binds sessions selected by canonical agent ids", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    {
      sessionID: "ses-test-3",
      agent: "coding-leader",
    },
    {
      message: { role: "user", parts: [] },
      parts: [],
    },
  );

  const output = {
    args: {
      subagent_type: "coding-executor",
    },
  };

  await plugin["tool.execute.before"]?.(
    {
      tool: "task",
      sessionID: "ses-test-3",
      callID: "call-test-3",
    },
    output,
  );

  assert.equal(output.args.subagent_type, "coding-executor");
});

test("session explicit agent selection overrides the forced default agent", async () => {
  const bindings = new Map();
  const checkpoints = new Map();
  const boot = createOpenCodeBootstrap({
    teamLibrary: loadDefaultTeamLibrary(process.cwd()),
    defaults: { defaultMode: "single-executor", defaultTeamId: "coding-team" },
    existingConfig: {
      default_agent: "foreign.plugin.agent",
      agent: {},
    },
    existingDefaultAgent: "foreign.plugin.agent",
  });
  const hook = createChatMessageHook({
    bindings,
    store: {
      setCheckpoint(sessionID, checkpoint) {
        checkpoints.set(sessionID, checkpoint);
      },
    },
    getBoot() {
      return boot;
    },
  });

  await hook(
    {
      sessionID: "ses-explicit-agent",
      agent: "coding-executor",
    },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  assert.equal(boot.mergedConfig?.default_agent, "coding-leader");
  assert.equal(bindings.get("ses-explicit-agent")?.selectedAgentId, "coding-executor");
  assert.equal(bindings.get("ses-explicit-agent")?.source, "host-agent-selection");
  assert.equal(checkpoints.get("ses-explicit-agent")?.agent, "coding-executor");
});
