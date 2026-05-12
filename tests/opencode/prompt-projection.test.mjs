import test from "node:test";
import assert from "node:assert/strict";

import { createEmbeddedCodingTeam } from "../../dist/src/agent-teams/embedded/coding-team.js";
import { loadDefaultTeamLibrary } from "../../dist/src/agent-teams/index.js";
import { createOpenCodeAgentPrompt, createOpenCodePromptFromRawDocuments } from "../../dist/src/adapters/opencode/prompt-builder.js";
import { buildPromptCatalog } from "../../dist/src/render/build-prompt-catalog.js";
import { loadAgentProfile } from "../../dist/src/loader/profile-loader.js";
import { normalizeProfileDocument } from "../../dist/src/normalize/normalize-document.js";
import { buildPromptPlan } from "../../dist/src/render/build-prompt-plan.js";
import { applyPromptProjection } from "../../dist/src/render/apply-prompt-projection.js";
import { createTeamLibraryProjection } from "../../dist/src/runtime/index.js";
import { renderPromptPlan } from "../../dist/src/render/structural-renderer.js";

function createProjectionForTeam(team) {
  return createTeamLibraryProjection({ version: "test", teams: [team] });
}

function getLoadedCodingTeam() {
  const library = loadDefaultTeamLibrary(process.cwd());
  const team = library.teams.find((entry) => entry.manifest.id === "coding-team");
  assert.ok(team, "expected coding-team to be present in default library");
  return team;
}

function getProjectedAgent(team, agentId) {
  return createProjectionForTeam(team).agents.find((agent) => agent.canonicalAgentId === agentId);
}

function createMinimalTeam(agent) {
  return {
    manifest: {
      id: "general-team",
      version: "1.0.0",
      name: "GeneralTeam",
      description: "general test team",
      mission: {
        objective: "Handle general tasks",
        successDefinition: ["Prompt renders"],
      },
      scope: {
        inScope: ["general tasks"],
        outOfScope: [],
      },
      leader: {
        agentRef: agent.metadata.id,
        responsibilities: ["lead"],
      },
      members: {
        [agent.metadata.id]: {
          responsibility: "lead",
          delegateWhen: "when needed",
          delegateMode: "default",
        },
      },
      workflow: {
        stages: ["intake", "deliver"],
      },
      governance: {
        instructionPrecedence: ["system", "team", "agent"],
        approvalPolicy: {
          requiredFor: [],
          allowAssumeFor: [],
        },
        forbiddenActions: ["fabricate evidence"],
        qualityFloor: {
          requiredChecks: ["prompt"],
          evidenceRequired: true,
        },
        workingRules: ["Stay grounded"],
      },
      tags: ["general"],
      promptProjection: {
        include: ["governance"],
      },
    },
    policy: {
      instructionPrecedence: ["system", "team", "agent"],
      approvalPolicy: {
        requiredFor: [],
        allowAssumeFor: [],
      },
      forbiddenActions: ["fabricate evidence"],
      qualityFloor: {
        requiredChecks: ["prompt"],
        evidenceRequired: true,
      },
      workingRules: ["Stay grounded"],
      promptProjection: { include: ["working_rules", "approval_safety"] },
    },
    agents: [agent],
  };
}

function createMinimalAgent(overrides = {}) {
  return {
    metadata: {
      id: "general-leader",
      name: "GeneralLeader",
      ...overrides.metadata,
    },
    personaCore: {
      temperament: "steady",
      cognitiveStyle: "direct",
      riskPosture: "balanced",
      communicationStyle: "concise",
      persistenceStyle: "persistent",
      decisionPriorities: ["correctness"],
      ...overrides.personaCore,
    },
    responsibilityCore: {
      description: "General lead",
      useWhen: ["general work"],
      avoidWhen: [],
      objective: "Deliver general tasks",
      successDefinition: ["done"],
      nonGoals: [],
      inScope: ["general"],
      outOfScope: [],
      ...overrides.responsibilityCore,
    },
    collaboration: {
      defaultConsults: [],
      defaultHandoffs: [],
      ...overrides.collaboration,
    },
    runtimeConfig: {
      requestedTools: [],
      permission: [],
      ...overrides.runtimeConfig,
    },
    outputContract: {
      tone: "neutral",
      defaultFormat: "short",
      updatePolicy: "final-only",
      ...overrides.outputContract,
    },
    executionPolicy: {
      routingRules: ["Route writing to writer agent"],
      ...overrides.executionPolicy,
    },
    entryPoint: {
      exposure: "user-selectable",
      selectionLabel: "general-leader",
      ...overrides.entryPoint,
    },
    promptProjection: overrides.promptProjection,
    extraSections: overrides.extraSections,
  };
}

test("loader rejects camelCase frontmatter keys", () => {
  assert.throws(
    () => loadAgentProfile({ id: "bad-agent", personaCore: { temperament: "bad" } }),
    /only supports snake_case keys/i,
  );
});

test("prompt_projection paths must also be snake_case", () => {
  assert.throws(
    () =>
      loadAgentProfile({
        id: "bad-agent",
        persona_core: { temperament: "steady" },
        prompt_projection: {
          include: ["personaCore"],
        },
      }),
    /snake_case paths/i,
  );
});

test("markdown body sections are parsed and rendered through the generic pipeline", () => {
  const prompt = createOpenCodePromptFromRawDocuments({
    teamManifestRaw: {
      id: "doc-team",
      name: "DocTeam",
    },
    teamPolicyRaw: {
      instruction_precedence: ["system"],
      quality_floor: { required_checks: ["prompt"], evidence_required: true },
      working_rules: ["Stay grounded"],
      approval_policy: { required_for: [], allow_assume_for: [] },
      forbidden_actions: ["avoid fabrication"],
      prompt_projection: { include: ["working_rules"] },
    },
    agentRaw: {
      id: "doc-agent",
      name: "DocAgent",
      persona_core: {
        temperament: "steady",
      },
      prompt_projection: {
        include: ["persona_core", "examples"],
      },
    },
    agentBody: `## Examples\n- Good fit\n- Keep evidence`,
  });

  assert.match(prompt, /### Examples/);
  assert.match(prompt, /- Good fit/);
  assert.match(prompt, /- Keep evidence/);
});

test("generic normalize and catalog keep arbitrary blocks without schema", () => {
  const loaded = loadAgentProfile(
    {
      id: "generic-agent",
      name: "Generic Agent",
      custom_review_rules: ["Check callers"],
      decision_profile: {
        risk_mode: "balanced",
      },
    },
  );
  const normalized = normalizeProfileDocument(loaded);
  const catalog = buildPromptCatalog(normalized);

  assert.deepEqual(
    normalized.blocks.map((block) => block.path),
    ["custom_review_rules", "decision_profile"],
  );
  assert.ok(catalog.nodes.some((node) => node.path === "custom_review_rules"));
  assert.ok(catalog.nodes.some((node) => node.path === "decision_profile"));
});

test("coding-leader prompt renders final semantic section ordering with strong content", () => {
  const projected = getProjectedAgent(getLoadedCodingTeam(), "coding-leader");
  assert.ok(projected);

  const prompt = createOpenCodeAgentPrompt(projected);

  assert.match(prompt, /## Team Contract/);
  assert.match(prompt, /### Working Rules/);
  assert.match(prompt, /### Approval & Safety/);
  assert.match(prompt, /## Agent Contract/);
  assert.match(prompt, /### Persona Core/);
  assert.match(prompt, /### Responsibility Core/);
  assert.match(prompt, /### Core Principle/);
  assert.match(prompt, /### Scope Control/);
  assert.match(prompt, /### Ambiguity Policy/);
  assert.match(prompt, /### Support Triggers/);
  assert.match(prompt, /### Task Triage/);
  assert.match(prompt, /### Delegation & Review/);
  assert.match(prompt, /### Completion Gate/);
  assert.match(prompt, /### Output Contract/);
  assert.doesNotMatch(prompt, /RequiredChecks|EvidenceRequired|RequiredFor|AllowAssumeFor/);
  assert.match(prompt, /Required Checks/);
  assert.match(prompt, /Evidence Required/);
  assert.match(prompt, /Approval Required For/);
  assert.match(prompt, /Allow Assume For/);
  assert.match(prompt, /Default Consults:\n  - Item 1:/);
  assert.match(prompt, /- Id: coding-codebase-explorer/);
  assert.match(prompt, /- Description: 定位实现位置、调用链、入口与既有模式。/);
  assert.match(prompt, /- When To Delegate: 实现位置或调用链不清时。/);
  assert.match(prompt, /持续推进，解决问题；只有在真实不可推进时才提问/);
  assert.match(prompt, /默认自己持有主链路/);
  assert.match(prompt, /已完成：/);
});

test("coordination-leader prompt renders coordination-specific sections structurally", () => {
  const projected = getProjectedAgent(getLoadedCodingTeam(), "coding-coordination-leader");
  assert.ok(projected);

  const prompt = createOpenCodeAgentPrompt(projected);

  assert.match(prompt, /### Core Principle/);
  assert.match(prompt, /### Concern Escalation Policy/);
  assert.match(prompt, /不直接承担主要实现工作/);
  assert.match(prompt, /### Operations/);
});

test("executor explorer reviewer and web researcher prompts all render", () => {
  const team = getLoadedCodingTeam();

  for (const agentId of ["coding-executor", "coding-codebase-explorer", "coding-reviewer", "coding-web-researcher"]) {
    const projected = getProjectedAgent(team, agentId);
    assert.ok(projected, `expected projected agent ${agentId}`);

    const prompt = createOpenCodeAgentPrompt(projected);
    assert.match(prompt, /## Agent Contract/);
    assert.ok(prompt.length > 300, `${agentId} prompt should not be trivial`);
  }
});

test("promptProjection include exclude labels works on generic path tree", () => {
  const loaded = loadAgentProfile(
    {
      id: "tree-agent",
      name: "Tree Agent",
      persona_core: {
        temperament: "steady",
        cognitive_style: "direct",
      },
      custom_review_rules: ["Check callers"],
      prompt_projection: {
        include: ["metadata.id", "persona_core.temperament", "custom_review_rules"],
        labels: {
          custom_review_rules: "Review Rules",
          "persona_core.temperament": "Mood",
        },
      },
    },
  );
  const plan = buildPromptPlan(
    applyPromptProjection(buildPromptCatalog(normalizeProfileDocument(loaded)), loaded.promptProjection),
  );
  const prompt = renderPromptPlan(plan);

  assert.match(prompt, /### Metadata/);
  assert.match(prompt, /- Id: tree-agent/);
  assert.match(prompt, /### Persona Core/);
  assert.match(prompt, /- Mood: steady/);
  assert.doesNotMatch(prompt, /Cognitive Style/);
  assert.match(prompt, /### Review Rules/);
});

test("minimal general team can define arbitrary content blocks without schema", () => {
  const agent = createMinimalAgent({
    extraSections: {
      decision_model: {
        routing_rules: ["Route writing to writer agent"],
      },
    },
    promptProjection: {
      include: ["decision_model", "metadata.id"],
      labels: {
        decision_model: "Decision Model",
      },
    },
  });
  const team = createMinimalTeam(agent);
  const projected = getProjectedAgent(team, "general-leader");
  assert.ok(projected);

  const prompt = createOpenCodeAgentPrompt(projected);

  assert.match(prompt, /### Decision Model/);
  assert.match(prompt, /- Routing Rules:/);
  assert.match(prompt, /Route writing to writer agent/);
  assert.match(prompt, /- Id: general-leader/);
});
