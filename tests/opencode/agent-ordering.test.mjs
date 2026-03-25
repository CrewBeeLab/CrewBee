import test from "node:test";
import assert from "node:assert/strict";

import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/library.js";
import { createTeamLibraryProjection, pickDefaultUserSelectableAgent } from "../../dist/src/runtime/index.js";
import { createOpenCodeBootstrap } from "../../dist/src/adapters/opencode/bootstrap.js";

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
    createTeamLibraryProjection({ version: "test", teams: [team] }).teams[0].userSelectableAgents.map((agent) => agent.sourceAgentId),
    ["leader-agent", "member-agent"],
  );
});

test("CodingTeam user-selectable agents respect leader-first priority ordering in runtime projection", () => {
  const projection = createTeamLibraryProjection(loadDefaultTeamLibrary(process.cwd()));
  const codingTeam = projection.teams.find((team) => team.team.manifest.id === "coding-team");

  assert.ok(codingTeam, "expected coding-team to be present");
  assert.deepEqual(
    codingTeam.userSelectableAgents.map((agent) => agent.sourceAgentId),
    ["coding-leader", "coordination-leader", "coding-executor"],
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

  assert.equal(bootstrap.configPatch.defaultAgent, "crewbee.coding-team.leader");
});
