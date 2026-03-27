import test from "node:test";
import assert from "node:assert/strict";

import { OpenCodeCrewBeePlugin } from "../../dist/src/adapters/opencode/plugin.js";

function createPluginInput() {
  return {
    client: {
      app: {
        log: async () => {},
      },
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

test("CrewBee rewrites CodingTeam source-agent task aliases to projected config keys", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    {
      sessionID: "ses-test-1",
      agent: "crewbee.coding-team.leader",
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

  assert.equal(output.args.subagent_type, "crewbee.coding-team.executor");
});

test("CrewBee injects hidden public-name aliases for OpenCode round-trip lookups", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  assert.equal(config.agent["crewbee.coding-team.leader"].name, "[CodingTeam]leader");
  assert.equal(config.agent["crewbee.coding-team.leader"].hidden, undefined);
  assert.equal(config.agent["[CodingTeam]leader"].name, "[CodingTeam]leader");
  assert.equal(config.agent["[CodingTeam]leader"].hidden, true);
});

test("CrewBee projects CodingTeam shell permissions as allow by default", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  assert.equal(config.agent["crewbee.coding-team.leader"].permission.bash["*"], "allow");
  assert.equal(config.agent["crewbee.coding-team.executor"].permission.bash["*"], "allow");
  assert.equal(config.agent["crewbee.coding-team.coordination-leader"].permission.bash["*"], "allow");
});

test("CrewBee upgrades web-researcher prompt and runtime for librarian-style research", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);

  const agent = config.agent["crewbee.coding-team.web-researcher"];

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

  const agent = config.agent["crewbee.coding-team.reviewer"];

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

  const agent = config.agent["crewbee.coding-team.principal-advisor"];

  assert.equal(agent.permission.task["*"], "allow");
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

test("CrewBee rewrites projected public task aliases case-insensitively", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    {
      sessionID: "ses-test-2",
      agent: "crewbee.coding-team.leader",
    },
    {
      message: { role: "user", parts: [] },
      parts: [],
    },
  );

  const output = {
    args: {
      subagent_type: "[CodingTeam]EXECUTOR",
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

  assert.equal(output.args.subagent_type, "crewbee.coding-team.executor");
});

test("CrewBee binds sessions selected by projected public agent names", async () => {
  const plugin = await OpenCodeCrewBeePlugin(createPluginInput());
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    {
      sessionID: "ses-test-3",
      agent: "[CodingTeam]leader",
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

  assert.equal(output.args.subagent_type, "crewbee.coding-team.executor");
});
