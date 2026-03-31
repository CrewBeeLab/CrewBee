import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/library.js";
import { validateTeamLibrary } from "../../dist/src/agent-teams/validation.js";
import { OpenCodeCrewBeePlugin } from "../../dist/src/adapters/opencode/plugin.js";

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
    model: gpt-5.4
  ${memberId}:
    provider: openai
    model: gpt-5.4
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

test("invalid file-based teams are skipped without blocking valid teams or plugin startup", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-partial-load-"));

  try {
    const teamRoot = path.join(workspace, "AgentTeams");
    const validTeamDir = path.join(teamRoot, "ValidTeam");
    const invalidTeamDir = path.join(teamRoot, "BrokenTeam");

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

    const library = loadDefaultTeamLibrary(workspace);
    const issues = validateTeamLibrary(library);
    const logs = [];
    const plugin = await OpenCodeCrewBeePlugin(createPluginInput(workspace, logs));
    const config = { agent: {} };

    await plugin.config?.(config);

    assert.ok(library.teams.some((team) => team.manifest.id === "coding-team"));
    assert.ok(library.teams.some((team) => team.manifest.id === "valid-team"));
    assert.ok(!library.teams.some((team) => team.manifest.id === "broken-team"));
    assert.ok(issues.some((issue) => issue.message.includes("Skipped Team 'BrokenTeam'")));
    assert.ok(config.agent["crewbee.coding-team.leader"]);
    assert.ok(config.agent["crewbee.valid-team.leader"]);
    assert.ok(!config.agent["crewbee.broken-team.leader"]);
    assert.ok(logs.some((entry) => entry.message.includes("Skipped Team 'BrokenTeam'")));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
