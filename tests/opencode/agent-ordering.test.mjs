import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/library.js";
import { createTeamLibraryProjection, pickDefaultUserSelectableAgent } from "../../dist/src/runtime/index.js";
import { createOpenCodeBootstrap } from "../../dist/src/adapters/opencode/bootstrap.js";

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

function createTestAgent(id, selectionPriority) {
  return {
    metadata: {
      id,
      name: id,
      archetype: "executor",
    },
    personaCore: {
      temperament: "steady",
      cognitiveStyle: "direct",
      riskPosture: "balanced",
      communicationStyle: "concise",
      persistenceStyle: "persistent",
      decisionPriorities: ["correctness"],
    },
    responsibilityCore: {
      description: `${id} description`,
      useWhen: ["test"],
      avoidWhen: [],
      objective: `Run as ${id}`,
      successDefinition: ["done"],
      nonGoals: [],
      inScope: ["tests"],
      outOfScope: [],
    },
    collaboration: {
      defaultConsults: [],
      defaultHandoffs: [],
    },
    runtimeConfig: {
      requestedTools: [],
      permission: [],
    },
    outputContract: {
      tone: "neutral",
      defaultFormat: "text",
      updatePolicy: "final-only",
    },
    entryPoint: {
      exposure: "user-selectable",
      selectionLabel: id,
      selectionPriority,
    },
  };
}

test("default user-selectable agent comes from the formal leader instead of raw priority", () => {
  const team = {
    manifest: {
      id: "test-team",
      version: "1.0.0",
      name: "TestTeam",
      description: "test",
      mission: {
        objective: "test",
        successDefinition: ["ok"],
      },
      scope: {
        inScope: ["test"],
        outOfScope: [],
      },
      leader: {
        agentRef: "leader-agent",
        responsibilities: ["lead"],
      },
      members: {
        "leader-agent": {
          responsibility: "lead",
          delegateWhen: "always",
          delegateMode: "default",
        },
        "member-agent": {
          responsibility: "member",
          delegateWhen: "always",
          delegateMode: "default",
        },
      },
      workflow: {
        stages: ["test"],
      },
      governance: {
        instructionPrecedence: ["test"],
        approvalPolicy: {
          requiredFor: [],
          allowAssumeFor: [],
        },
        forbiddenActions: [],
        qualityFloor: {
          requiredChecks: [],
          evidenceRequired: false,
        },
        workingRules: [],
      },
      tags: [],
    },
    agents: [createTestAgent("member-agent", 0), createTestAgent("leader-agent", 5)],
  };

  assert.equal(pickDefaultUserSelectableAgent(team)?.metadata.id, "leader-agent");
  assert.deepEqual(
    createTeamLibraryProjection({ version: "test", teams: [team] }).teams[0].userSelectableAgents.map((agent) => agent.canonicalAgentId),
    ["leader-agent", "member-agent"],
  );
});

test("CodingTeam user-selectable agents respect leader-first priority ordering in runtime projection", () => {
  const projection = createTeamLibraryProjection(loadDefaultTeamLibrary(process.cwd()));
  const codingTeam = projection.teams.find((team) => team.team.manifest.id === "coding-team");

  assert.ok(codingTeam, "expected coding-team to be present");
  assert.deepEqual(
    codingTeam.userSelectableAgents.map((agent) => agent.canonicalAgentId),
    ["coding-leader", "coding-coordination-leader", "coding-executor"],
  );
});

test("OpenCode bootstrap defaults to the formal CodingTeam leader", () => {
  const bootstrap = createOpenCodeBootstrap({
    teamLibrary: loadDefaultTeamLibrary(process.cwd()),
    defaults: {
      defaultMode: "single-executor",
      defaultTeamId: "coding-team",
    },
  });

  assert.equal(bootstrap.configPatch.defaultAgent, "coding-leader");
});

test("OpenCode bootstrap force-overwrites a foreign default agent", () => {
  const bootstrap = createOpenCodeBootstrap({
    teamLibrary: loadDefaultTeamLibrary(process.cwd()),
    defaults: {
      defaultMode: "single-executor",
      defaultTeamId: "coding-team",
    },
    existingConfig: {
      default_agent: "foreign.plugin.agent",
      agent: {},
    },
    existingDefaultAgent: "foreign.plugin.agent",
  });

  assert.equal(bootstrap.configPatch.defaultAgent, "coding-leader");
  assert.equal(bootstrap.mergedConfig?.default_agent, "coding-leader");
});

test("OpenCode bootstrap refreshes managed canonical ids while preserving foreign agents", () => {
  const bootstrap = createOpenCodeBootstrap({
    teamLibrary: loadDefaultTeamLibrary(process.cwd()),
    defaults: {
      defaultMode: "single-executor",
      defaultTeamId: "coding-team",
    },
    existingConfig: {
      default_agent: "coding-leader",
      agent: {
        "coding-leader": {
          name: "coding-leader",
          description: "stale managed leader",
          mode: "primary",
          prompt: "stale",
          permission: {},
          options: {
            crewbee: {
              managed: true,
              teamId: "coding-team",
              canonicalAgentId: "coding-leader",
            },
          },
        },
        "foreign.agent": {
          name: "foreign.agent",
          description: "foreign",
          mode: "primary",
          prompt: "foreign",
          permission: {},
        },
      },
    },
  });

  assert.equal(bootstrap.mergedConfig?.default_agent, "coding-leader");
  assert.equal(bootstrap.mergedConfig?.agent?.["foreign.agent"]?.name, "foreign.agent");
  assert.equal(bootstrap.mergedConfig?.agent?.["coding-leader"]?.name, "coding-leader");
  assert.notEqual(bootstrap.mergedConfig?.agent?.["coding-leader"]?.prompt, "stale");
});

test("team priority controls projected agent order and bootstrap default agent", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "crewbee-agent-priority-"));
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;

  try {
    const configRoot = path.join(workspace, ".config", "opencode");
    const priorityTeamDir = path.join(configRoot, "custom", "PriorityTeam");

    process.env.OPENCODE_CONFIG_DIR = configRoot;

    writeFile(
      path.join(configRoot, "crewbee.json"),
      createCrewBeeConfig([
        { id: "coding-team", enabled: true, priority: 5 },
        { path: "@custom/PriorityTeam", enabled: true, priority: 0 },
      ]),
    );
    writeFile(path.join(priorityTeamDir, "team.manifest.yaml"), createTeamManifest("priority-team", "PriorityTeam", "priority-leader", "priority-executor"));
    writeFile(path.join(priorityTeamDir, "team.policy.yaml"), createTeamPolicy());
    writeFile(path.join(priorityTeamDir, "TEAM.md"), "# PriorityTeam\n");
    writeFile(
      path.join(priorityTeamDir, "priority-leader.agent.md"),
      createAgentProfile("priority-leader", "Priority Leader", "user-selectable", "leader", "priority-executor", "priority-executor"),
    );
    writeFile(
      path.join(priorityTeamDir, "priority-executor.agent.md"),
      createAgentProfile("priority-executor", "Priority Executor", "internal-only", "executor", undefined, undefined),
    );

    const library = loadDefaultTeamLibrary(workspace);
    const projection = createTeamLibraryProjection(library);
    const bootstrap = createOpenCodeBootstrap({
      teamLibrary: library,
      defaults: {
        defaultMode: "single-executor",
      },
    });

    assert.deepEqual(
      projection.teams.map((team) => team.team.manifest.id).slice(0, 2),
      ["priority-team", "coding-team"],
    );
    assert.deepEqual(
      projection.agents.slice(0, 2).map((agent) => `${agent.teamId}/${agent.canonicalAgentId}`),
      ["priority-team/priority-leader", "priority-team/priority-executor"],
    );
    assert.equal(bootstrap.configPatch.defaultAgent, "priority-leader");
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    }

    rmSync(workspace, { recursive: true, force: true });
  }
});

test("bootstrap falls back to the next team when the highest-priority team has no user-selectable agent", () => {
  const teamPolicy = {
    instructionPrecedence: ["test"],
    approvalPolicy: {
      requiredFor: [],
      allowAssumeFor: [],
    },
    forbiddenActions: [],
    qualityFloor: {
      requiredChecks: [],
      evidenceRequired: false,
    },
    workingRules: [],
  };
  const blockedTeam = {
    manifest: {
      id: "blocked-team",
      version: "1.0.0",
      name: "BlockedTeam",
      description: "blocked",
      mission: {
        objective: "blocked",
        successDefinition: ["ok"],
      },
      scope: {
        inScope: ["test"],
        outOfScope: [],
      },
      leader: {
        agentRef: "blocked-leader",
        responsibilities: ["lead"],
      },
      members: {
        "blocked-executor": {
          responsibility: "member",
          delegateWhen: "always",
          delegateMode: "default",
        },
      },
      workflow: {
        stages: ["test"],
      },
      governance: {
        instructionPrecedence: ["test"],
        approvalPolicy: {
          requiredFor: [],
          allowAssumeFor: [],
        },
        forbiddenActions: [],
        qualityFloor: {
          requiredChecks: [],
          evidenceRequired: false,
        },
        workingRules: [],
      },
      tags: [],
    },
    policy: teamPolicy,
    agents: [
      {
        ...createTestAgent("blocked-leader", 0),
        entryPoint: {
          exposure: "internal-only",
          selectionLabel: "blocked-leader",
        },
      },
      {
        ...createTestAgent("blocked-executor", 1),
        entryPoint: {
          exposure: "internal-only",
          selectionLabel: "blocked-executor",
        },
      },
    ],
  };
  const readyTeam = {
    manifest: {
      id: "ready-team",
      version: "1.0.0",
      name: "ReadyTeam",
      description: "ready",
      mission: {
        objective: "ready",
        successDefinition: ["ok"],
      },
      scope: {
        inScope: ["test"],
        outOfScope: [],
      },
      leader: {
        agentRef: "ready-leader",
        responsibilities: ["lead"],
      },
      members: {
        "ready-executor": {
          responsibility: "member",
          delegateWhen: "always",
          delegateMode: "default",
        },
      },
      workflow: {
        stages: ["test"],
      },
      governance: {
        instructionPrecedence: ["test"],
        approvalPolicy: {
          requiredFor: [],
          allowAssumeFor: [],
        },
        forbiddenActions: [],
        qualityFloor: {
          requiredChecks: [],
          evidenceRequired: false,
        },
        workingRules: [],
      },
      tags: [],
    },
    policy: teamPolicy,
    agents: [createTestAgent("ready-leader", 0), createTestAgent("ready-executor", 1)],
  };

  const bootstrap = createOpenCodeBootstrap({
    teamLibrary: {
      version: "test",
      teams: [blockedTeam, readyTeam],
    },
    defaults: {
      defaultMode: "single-executor",
    },
  });

  assert.equal(bootstrap.configPatch.defaultAgent, "ready-leader");
});
