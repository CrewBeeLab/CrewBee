import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/library.js";
import { validateTeamLibrary } from "../../dist/src/agent-teams/validation.js";
import { OpenCodeCrewBeePlugin } from "../../dist/src/adapters/opencode/plugin.js";
import BundledOpenCodeCrewBeePlugin from "../../dist/opencode-plugin.mjs";

function createPluginInput(worktree, logs) {
  return {
    client: {
      app: {
        log: async (entry) => {
          logs.push(entry.body);
        },
      },
    },
    project: {
      id: "test-project",
      directory: worktree,
      worktree,
    },
    directory: worktree,
    worktree,
    $() {
      throw new Error("Shell access is not available in tests.");
    },
  };
}

function writeFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function createCrewBeeConfig(teams) {
  return JSON.stringify({ teams }, null, 2);
}

function createTeamPolicy() {
  return `kind: team-policy
instruction_precedence:
  - platform rules
approval_policy:
  required_for:
    - destructive actions
  allow_assume_for:
    - low-risk implementation details
forbidden_actions:
  - fabricate evidence
quality_floor:
  required_checks:
    - diagnostics
  evidence_required: true
working_rules:
  - leader is the primary interface
`;
}

function createTeamManifest(teamId, teamName, leaderId, memberId) {
  return `id: ${teamId}
version: 1.0.0
name: ${teamName}
description: Test team
mission:
  objective: Keep valid teams loadable.
  success_definition:
    - Valid teams still project.
scope:
  in_scope:
    - tests
  out_of_scope:
    - none
leader:
  agent_ref: ${leaderId}
  responsibilities:
    - Lead the team
members:
  ${memberId}:
    responsibility: Delivery
    delegate_when: When execution is clear.
    delegate_mode: direct execution.
workflow:
  stages:
    - intake
governance:
  instruction_precedence:
    - platform rules
  approval_policy:
    required_for:
      - destructive actions
    allow_assume_for:
      - low-risk implementation details
  forbidden_actions:
    - fabricate evidence
  quality_floor:
    required_checks:
      - diagnostics
    evidence_required: true
  working_rules:
    - leader is the primary interface
agent_runtime:
  ${leaderId}:
    provider: openai
    model: gpt-5.5
  ${memberId}:
    provider: openai
    model: gpt-5.5
tags:
  - tests
`;
}

function createAgentProfile(agentId, agentName, exposure, selectionLabel, consultTarget, handoffTarget) {
  const defaultConsults = consultTarget
    ? `  default_consults:\n    - agent_ref: ${consultTarget}\n      description: Consultation target.\n`
    : "  default_consults: []\n";
  const defaultHandoffs = handoffTarget
    ? `  default_handoffs:\n    - agent_ref: ${handoffTarget}\n      description: Handoff target.\n`
    : "  default_handoffs: []\n";

  return `---
id: ${agentId}
name: ${agentName}
archetype: orchestrator
persona_core:
  temperament: calm
  cognitive_style: direct
  risk_posture: balanced
  communication_style: concise
  persistence_style: high
  decision_priorities:
    - correctness
responsibility_core:
  description: ${agentName} description.
  use_when:
    - Test coverage needs this agent.
  avoid_when:
    - Never
  objective: ${agentName} objective.
  success_definition:
    - Return a useful result.
  non_goals:
    - none
  in_scope:
    - tests
  out_of_scope:
    - none
  authority: Operate within the assigned scope.
collaboration:
${defaultConsults}${defaultHandoffs}runtime_config:
  requested_tools:
    - read
  permission:
    - permission: read
      pattern: "*"
      action: allow
output_contract:
  tone: concise
  default_format: text
  update_policy: final-only
entry_point:
  exposure: ${exposure}
  selection_label: ${selectionLabel}
  selection_description: ${agentName} selection.
---
`;
}

function createAgentProfileWithoutCollaboration(agentId, agentName, exposure, selectionLabel) {
  return `---
id: ${agentId}
name: ${agentName}
archetype: executor
persona_core:
  temperament: calm
  cognitive_style: direct
  risk_posture: balanced
  communication_style: concise
  persistence_style: high
  decision_priorities:
    - correctness
responsibility_core:
  description: ${agentName} description.
  use_when:
    - Test coverage needs this agent.
  avoid_when:
    - Never
  objective: ${agentName} objective.
  success_definition:
    - Return a useful result.
  non_goals:
    - none
  in_scope:
    - tests
  out_of_scope:
    - none
runtime_config:
  requested_tools:
    - read
  permission:
    - permission: read
      pattern: "*"
      action: allow
output_contract:
  tone: concise
  default_format: text
  update_policy: final-only
entry_point:
  exposure: ${exposure}
  selection_label: ${selectionLabel}
  selection_description: ${agentName} selection.
---
`;
}

function createBrokenAgentProfile(agentId, agentName) {
  return `---
id: ${agentId}
name: ${agentName}
archetype: executor
persona_core:
  temperament: calm
responsibility_core:
  description: Broken agent missing required profile fields.
---
`;
}

test("invalid configured file-based teams are skipped without blocking valid teams or plugin startup", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-partial-load-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const validTeamDir = path.join(configRoot, "tmp", "ValidTeam");
    const invalidTeamDir = path.join(configRoot, "tmp", "BrokenTeam");
    const hiddenLeaderTeamDir = path.join(configRoot, "tmp", "HiddenLeaderTeam");
    const legacyWorktreeTeamDir = path.join(workspace, "teams", "LegacyTeam");

    process.env.OPENCODE_CONFIG_DIR = configRoot;

    writeFile(
      path.join(configRoot, "crewbee.json"),
      createCrewBeeConfig([
        { id: "coding-team", enabled: true, priority: 0 },
        { path: "@tmp/ValidTeam", enabled: true },
        { path: "@tmp/BrokenTeam", enabled: true },
        { path: "@tmp/HiddenLeaderTeam", enabled: true },
      ]),
    );

    writeFile(path.join(validTeamDir, "team.manifest.yaml"), createTeamManifest("valid-team", "ValidTeam", "valid-leader", "valid-executor"));
    writeFile(path.join(validTeamDir, "team.policy.yaml"), createTeamPolicy());
    writeFile(path.join(validTeamDir, "TEAM.md"), "# ValidTeam\n");
    writeFile(
      path.join(validTeamDir, "valid-leader.agent.md"),
      createAgentProfile("valid-leader", "Valid Leader", "user-selectable", "leader", "valid-executor", "valid-executor"),
    );
    writeFile(
      path.join(validTeamDir, "valid-executor.agent.md"),
      createAgentProfile("valid-executor", "Valid Executor", "internal-only", "executor", undefined, undefined),
    );

    writeFile(path.join(invalidTeamDir, "team.manifest.yaml"), createTeamManifest("broken-team", "BrokenTeam", "broken-leader", "broken-executor"));
    writeFile(path.join(invalidTeamDir, "team.policy.yaml"), createTeamPolicy());

    writeFile(path.join(hiddenLeaderTeamDir, "team.manifest.yaml"), createTeamManifest("hidden-leader-team", "HiddenLeaderTeam", "hidden-leader", "hidden-executor"));
    writeFile(path.join(hiddenLeaderTeamDir, "team.policy.yaml"), createTeamPolicy());
    writeFile(path.join(hiddenLeaderTeamDir, "TEAM.md"), "# HiddenLeaderTeam\n");
    writeFile(
      path.join(hiddenLeaderTeamDir, "hidden-leader.agent.md"),
      createAgentProfile("hidden-leader", "Hidden Leader", "internal-only", "leader", "hidden-executor", "hidden-executor"),
    );
    writeFile(
      path.join(hiddenLeaderTeamDir, "hidden-executor.agent.md"),
      createAgentProfile("hidden-executor", "Hidden Executor", "internal-only", "executor", undefined, undefined),
    );

    writeFile(path.join(legacyWorktreeTeamDir, "team.manifest.yaml"), createTeamManifest("legacy-team", "LegacyTeam", "legacy-leader", "legacy-executor"));
    writeFile(path.join(legacyWorktreeTeamDir, "team.policy.yaml"), createTeamPolicy());
    writeFile(path.join(legacyWorktreeTeamDir, "TEAM.md"), "# LegacyTeam\n");
    writeFile(
      path.join(legacyWorktreeTeamDir, "legacy-leader.agent.md"),
      createAgentProfile("legacy-leader", "Legacy Leader", "user-selectable", "leader", "legacy-executor", "legacy-executor"),
    );
    writeFile(
      path.join(legacyWorktreeTeamDir, "legacy-executor.agent.md"),
      createAgentProfile("legacy-executor", "Legacy Executor", "internal-only", "executor", undefined, undefined),
    );

    const library = loadDefaultTeamLibrary(workspace);
    const issues = validateTeamLibrary(library);
    const logs = [];
    const plugin = await OpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    assert.ok(library.teams.some((team) => team.manifest.id === "coding-team"));
    assert.ok(library.teams.some((team) => team.manifest.id === "valid-team"));
    assert.ok(!library.teams.some((team) => team.manifest.id === "broken-team"));
    assert.ok(!library.teams.some((team) => team.manifest.id === "hidden-leader-team"));
    assert.ok(!library.teams.some((team) => team.manifest.id === "legacy-team"));
    assert.ok(issues.some((issue) => issue.message.includes("Skipped Team 'BrokenTeam'")));
    assert.ok(issues.some((issue) => issue.message.includes("Leader agent 'hidden-leader' must be user-selectable.")));
    assert.ok(config.agent["coding-leader"]);
    assert.ok(config.agent["valid-leader"]);
    assert.ok(!config.agent["broken-leader"]);
    assert.ok(!config.agent["hidden-leader"]);
    assert.ok(!config.agent["legacy-leader"]);
    assert.ok(logs.some((entry) => entry.message.includes("Skipped Team 'BrokenTeam'")));
    assert.ok(logs.some((entry) => entry.message.includes("Leader agent 'hidden-leader' must be user-selectable.")));
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});

test("invalid non-leader agents are skipped without invalidating the containing team", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-agent-partial-load-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const teamDir = path.join(configRoot, "tmp", "PartiallyBrokenTeam");
    const logs = [];

    process.env.OPENCODE_CONFIG_DIR = configRoot;

    writeFile(
      path.join(configRoot, "crewbee.json"),
      createCrewBeeConfig([{ path: "@tmp/PartiallyBrokenTeam", enabled: true, priority: 0 }]),
    );
    writeFile(path.join(teamDir, "team.manifest.yaml"), createTeamManifest("partially-broken-team", "PartiallyBrokenTeam", "partial-leader", "partial-executor"));
    writeFile(path.join(teamDir, "team.policy.yaml"), createTeamPolicy());
    writeFile(path.join(teamDir, "TEAM.md"), "# PartiallyBrokenTeam\n");
    writeFile(
      path.join(teamDir, "partial-leader.agent.md"),
      createAgentProfile("partial-leader", "Partial Leader", "user-selectable", "leader", "partial-executor", "partial-executor"),
    );
    writeFile(
      path.join(teamDir, "partial-executor.agent.md"),
      createAgentProfileWithoutCollaboration("partial-executor", "Partial Executor", "internal-only", "executor"),
    );
    writeFile(
      path.join(teamDir, "broken-extra.agent.md"),
      createBrokenAgentProfile("broken-extra", "Broken Extra"),
    );

    const library = loadDefaultTeamLibrary(workspace);
    const issues = validateTeamLibrary(library);
    const team = library.teams.find((entry) => entry.manifest.id === "partially-broken-team");
    const plugin = await OpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    assert.ok(team);
    assert.deepEqual(
      team.agents.map((agent) => agent.metadata.id).sort(),
      ["partially-broken-partial-executor", "partially-broken-partial-leader"],
    );
    assert.deepEqual(team.agents.find((agent) => agent.metadata.id === "partially-broken-partial-executor").collaboration, {
      defaultConsults: [],
      defaultHandoffs: [],
    });
    assert.ok(config.agent["partially-broken-partial-leader"]);
    assert.ok(!config.agent["broken-extra"]);
    assert.ok(issues.some((issue) => issue.level === "error" && issue.blocking === false && issue.message.includes("Skipped Agent 'broken-extra.agent.md'")));
    assert.ok(!issues.some((issue) => issue.level === "error" && issue.blocking !== false));
    assert.ok(logs.some((entry) => entry.level === "error" && entry.message.includes("Skipped Agent 'broken-extra.agent.md'")));
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});

test("plugin startup auto-creates default crewbee.json when missing", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-plugin-config-missing-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const logs = [];

    process.env.OPENCODE_CONFIG_DIR = configRoot;

    const plugin = await OpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    const configPath = path.join(configRoot, "crewbee.json");

    assert.equal(existsSync(configPath), true);
    assert.equal(existsSync(path.join(configRoot, "teams", "general-team", "team.manifest.yaml")), true);
    assert.deepEqual(
      JSON.parse(readFileSync(configPath, "utf8")),
      JSON.parse(readFileSync(path.join(process.cwd(), "templates", "crewbee.json"), "utf8")),
    );
    assert.ok(config.agent["coding-leader"]);
    assert.ok(logs.some((entry) => entry.message.includes("CrewBee auto-repaired Team config")));
    assert.ok(logs.some((entry) => entry.extra?.reason === "created-default"));
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});

test("bundled plugin startup creates crewbee.json from packaged template", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-bundled-plugin-config-missing-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const logs = [];

    process.env.OPENCODE_CONFIG_DIR = configRoot;

    const plugin = await BundledOpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    const configPath = path.join(configRoot, "crewbee.json");

    assert.deepEqual(
      JSON.parse(readFileSync(configPath, "utf8")),
      JSON.parse(readFileSync(path.join(process.cwd(), "templates", "crewbee.json"), "utf8")),
    );
    assert.equal(existsSync(path.join(configRoot, "teams", "general-team", "team.manifest.yaml")), true);
    assert.ok(config.agent["coding-leader"]);
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});

test("plugin startup uses project crewbee config as default agent source", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-plugin-project-config-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const projectConfigRoot = path.join(workspace, ".crewbee");
    const projectTeamDir = path.join(projectConfigRoot, "teams", "ProjectTeam");
    const logs = [];

    process.env.OPENCODE_CONFIG_DIR = configRoot;

    writeFile(path.join(configRoot, "crewbee.json"), createCrewBeeConfig([{ id: "coding-team", enabled: true, priority: 0 }]));
    writeFile(path.join(projectConfigRoot, "crewbee.json"), createCrewBeeConfig([{ path: "@teams/ProjectTeam", enabled: true, priority: 10 }]));
    writeFile(path.join(projectTeamDir, "team.manifest.yaml"), createTeamManifest("project-team", "ProjectTeam", "project-leader", "project-executor"));
    writeFile(path.join(projectTeamDir, "team.policy.yaml"), createTeamPolicy());
    writeFile(path.join(projectTeamDir, "project-leader.agent.md"), createAgentProfile("project-leader", "Project Leader", "user-selectable", "leader", "project-executor", "project-executor"));
    writeFile(path.join(projectTeamDir, "project-executor.agent.md"), createAgentProfile("project-executor", "Project Executor", "internal-only", "executor", undefined, undefined));

    const plugin = await OpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    assert.equal(config.default_agent, "project-leader");
    assert.ok(config.agent["project-leader"]);
    assert.ok(config.agent["coding-leader"]);
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});

test("plugin startup repairs invalid crewbee.json automatically", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-plugin-config-invalid-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;
  const invalidContent = "{broken json";

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const logs = [];

    process.env.OPENCODE_CONFIG_DIR = configRoot;
    writeFile(path.join(configRoot, "crewbee.json"), invalidContent);

    const plugin = await OpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    const configPath = path.join(configRoot, "crewbee.json");
    const backupPath = `${configPath}.bak`;

    assert.deepEqual(
      JSON.parse(readFileSync(configPath, "utf8")),
      JSON.parse(readFileSync(path.join(process.cwd(), "templates", "crewbee.json"), "utf8")),
    );
    assert.equal(existsSync(path.join(configRoot, "teams", "general-team", "team.manifest.yaml")), true);
    assert.equal(readFileSync(backupPath, "utf8"), invalidContent);
    assert.ok(config.agent["coding-leader"]);
    assert.ok(logs.some((entry) => entry.message.includes("CrewBee auto-repaired Team config")));
    assert.ok(logs.some((entry) => entry.extra?.reason === "repaired-invalid"));
    assert.ok(logs.some((entry) => entry.extra?.backupPath === backupPath));
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});
