import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";

import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/library.js";
import { validateTeamLibrary } from "../../dist/src/agent-teams/validation.js";
import { createEmbeddedCodingTeam } from "../../dist/src/agent-teams/embedded/coding-team.js";
import { runDoctor } from "../../dist/src/install/doctor.js";

function writeFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// The embedded manifest is built in code with camelCase keys; mapTeamManifest
// requires snake_case in nested sections, so convert before serializing. This is
// the "copy of the embedded manifest" from the feature's minimal example.
function toSnakeKeys(value) {
  if (Array.isArray(value)) {
    return value.map(toSnakeKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
        toSnakeKeys(entry),
      ]),
    );
  }

  return value;
}

function createEmbeddedManifestYaml(overrides = {}) {
  return stringify(toSnakeKeys({ ...createEmbeddedCodingTeam().manifest, ...overrides }));
}

function createTeamPolicy(marker) {
  const markerLine = marker ? `  - ${marker}\n` : "";
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
${markerLine}`;
}

function createTeamManifest(teamId, teamName, leaderId, memberId) {
  return `id: ${teamId}
version: 1.0.0
name: ${teamName}
description: Test team.
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
tags:
  - tests
`;
}

function createAgentProfile(agentId, agentName, exposure, selectionLabel) {
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
    - Tests need this agent.
  avoid_when:
    - Never.
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
  default_consults: []
  default_handoffs: []
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

const EMBEDDED_AGENT_IDS = [
  "coding-leader",
  "coordination-leader",
  "coding-executor",
  "codebase-explorer",
  "web-researcher",
  "reviewer",
  "principal-advisor",
  "multimodal-looker",
];

function withConfigRoot(run) {
  return async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-partial-override-"));
    const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

    try {
      const configRoot = path.join(workspace, ".config", "opencode");
      process.env.OPENCODE_CONFIG_DIR = configRoot;
      await run({ workspace, configRoot });
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR;
      } else {
        process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
      }

      rmSync(workspace, { recursive: true, force: true });
    }
  };
}

test("partial file team merges with the embedded coding-team per agent", withConfigRoot(async ({ workspace, configRoot }) => {
  const teamDir = path.join(configRoot, "teams", "coding-team");

  writeFile(
    path.join(configRoot, "crewbee.json"),
    JSON.stringify({ teams: [{ path: "@teams/coding-team", enabled: true }] }, null, 2),
  );
  writeFile(path.join(teamDir, "team.manifest.yaml"), createEmbeddedManifestYaml());
  writeFile(
    path.join(teamDir, "reviewer.agent.md"),
    createAgentProfile("reviewer", "FILE-REVIEWER-MARKER", "user-selectable", "review"),
  );

  const library = loadDefaultTeamLibrary({ globalConfigRoot: configRoot, projectWorktree: workspace });
  const team = library.teams.find((entry) => entry.manifest.id === "coding-team");
  const issues = validateTeamLibrary(library);

  assert.ok(team, "merged coding-team must load");
  assert.equal(team.agents.length, 8, "merged team keeps all eight embedded agents");

  const reviewer = team.agents.find((agent) => agent.metadata.id === "coding-reviewer");
  assert.ok(reviewer, "reviewer must map to its canonical id");
  assert.equal(reviewer.entryPoint?.selectionDescription, "FILE-REVIEWER-MARKER selection.", "file reviewer wins");

  for (const agentId of ["coding-leader", "coding-executor", "coding-codebase-explorer"]) {
    const agent = team.agents.find((entry) => entry.metadata.id === agentId);
    assert.ok(agent, `${agentId} must come from the embedded team`);
    assert.notEqual(agent.entryPoint?.selectionDescription, "FILE-REVIEWER-MARKER selection.", `${agentId} must not be the file agent`);
  }

  assert.ok(team.policy, "policy falls back to the embedded team");
  assert.equal(
    library.loadIssues?.some((issue) => issue.code === "team_id_shadowed_or_duplicate" || issue.code === "team_merge_failed"),
    false,
    "a valid partial override must not emit collision or merge warnings",
  );
  assert.deepEqual(issues, [], "a valid partial override loads with zero team issues");
}));

test("manifest-only file team inherits embedded agents and policy", withConfigRoot(async ({ workspace, configRoot }) => {
  const teamDir = path.join(configRoot, "teams", "coding-team");

  writeFile(
    path.join(configRoot, "crewbee.json"),
    JSON.stringify({ teams: [{ path: "@teams/coding-team", enabled: true }] }, null, 2),
  );
  writeFile(path.join(teamDir, "team.manifest.yaml"), createEmbeddedManifestYaml({ name: "ManifestOnlyOverride" }));

  const library = loadDefaultTeamLibrary({ globalConfigRoot: configRoot, projectWorktree: workspace });
  const team = library.teams.find((entry) => entry.manifest.id === "coding-team");

  assert.ok(team, "manifest-only override must load");
  assert.equal(team.manifest.name, "ManifestOnlyOverride", "file manifest wins");
  assert.equal(team.agents.length, 8, "every agent comes from the embedded team");
  assert.ok(team.policy, "policy comes from the embedded team");
  assert.deepEqual(validateTeamLibrary(library), [], "manifest-only override loads with zero team issues");
}));

test("full file team wins on every artifact (back-compat)", withConfigRoot(async ({ workspace, configRoot }) => {
  const teamDir = path.join(configRoot, "teams", "coding-team");

  writeFile(
    path.join(configRoot, "crewbee.json"),
    JSON.stringify({ teams: [{ path: "@teams/coding-team", enabled: true }] }, null, 2),
  );
  writeFile(path.join(teamDir, "team.manifest.yaml"), createEmbeddedManifestYaml({ name: "FullFileTeam" }));
  writeFile(path.join(teamDir, "team.policy.yaml"), createTeamPolicy("FULL-TEAM-POLICY-MARKER"));
  for (const agentId of EMBEDDED_AGENT_IDS) {
    const exposure = agentId === "coding-leader" ? "user-selectable" : "internal-only";
    writeFile(
      path.join(teamDir, `${agentId}.agent.md`),
      createAgentProfile(agentId, `FILE-${agentId.toUpperCase()}-MARKER`, exposure, agentId),
    );
  }

  const library = loadDefaultTeamLibrary({ globalConfigRoot: configRoot, projectWorktree: workspace });
  const team = library.teams.find((entry) => entry.manifest.id === "coding-team");
  const issues = validateTeamLibrary(library);

  assert.ok(team, "full file team must load");
  assert.equal(team.manifest.name, "FullFileTeam", "file manifest wins");
  assert.ok(team.policy?.workingRules?.some((rule) => rule.includes("FULL-TEAM-POLICY-MARKER")), "file policy wins");
  assert.equal(team.agents.length, 8, "all eight agents defined by the file team");
  for (const agent of team.agents) {
    const expected = `FILE-${agent.metadata.sourceId?.toUpperCase() ?? agent.metadata.id.toUpperCase()}-MARKER selection.`;
    assert.equal(agent.entryPoint?.selectionDescription, expected, `${agent.metadata.id} must be the file version`);
  }
  assert.deepEqual(issues, [], "full file team loads with zero team issues");
}));

test("pure file team without a policy still fails to load", withConfigRoot(async ({ workspace, configRoot }) => {
  const teamDir = path.join(configRoot, "teams", "solo-team");

  writeFile(
    path.join(configRoot, "crewbee.json"),
    JSON.stringify({ teams: [{ path: "@teams/solo-team", enabled: true }] }, null, 2),
  );
  writeFile(path.join(teamDir, "team.manifest.yaml"), createTeamManifest("solo-team", "SoloTeam", "solo-leader", "solo-executor"));
  writeFile(
    path.join(teamDir, "solo-leader.agent.md"),
    createAgentProfile("solo-leader", "Solo Leader", "user-selectable", "leader"),
  );
  writeFile(
    path.join(teamDir, "solo-executor.agent.md"),
    createAgentProfile("solo-executor", "Solo Executor", "internal-only", "executor"),
  );

  const library = loadDefaultTeamLibrary({ globalConfigRoot: configRoot, projectWorktree: workspace });

  assert.equal(library.teams.some((entry) => entry.manifest.id === "solo-team"), false, "a policy-less pure file team must not load");
  assert.ok(
    library.loadIssues?.some((issue) => issue.message.includes("team.policy.yaml")),
    "the missing policy must be reported",
  );
}));

test("doctor reports zero team issues for a partial override", withConfigRoot(async ({ workspace, configRoot }) => {
  const teamDir = path.join(configRoot, "teams", "coding-team");
  const configPath = path.join(configRoot, "crewbee.json");

  writeFile(configPath, JSON.stringify({ teams: [{ path: "@teams/coding-team", enabled: true }] }, null, 2));
  writeFile(path.join(teamDir, "team.manifest.yaml"), createEmbeddedManifestYaml());
  writeFile(
    path.join(teamDir, "reviewer.agent.md"),
    createAgentProfile("reviewer", "FILE-REVIEWER-MARKER", "user-selectable", "review"),
  );

  const result = await runDoctor({
    configPath,
    installRoot: path.join(workspace, ".cache", "opencode"),
    projectWorktree: workspace,
  });

  assert.deepEqual(result.teamIssues, [], "doctor must report Team issues: 0 for a partial team");
  assert.equal(result.blockingTeamIssueCount, 0, "no blocking team issues");
  assert.equal(result.teamHealthy, true, "team health check must pass");
}));
