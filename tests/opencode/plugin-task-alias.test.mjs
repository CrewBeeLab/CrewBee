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
