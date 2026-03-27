import test from "node:test";
import assert from "node:assert/strict";

import { createEmbeddedCodingTeam } from "../../dist/src/agent-teams/embedded/coding-team.js";
import { createOpenCodeAgentPrompt, createOpenCodePromptFromDocuments } from "../../dist/src/adapters/opencode/prompt-builder.js";
import { buildPromptCatalog } from "../../dist/src/catalog/build-prompt-catalog.js";
import { loadProfileDocument } from "../../dist/src/loader/profile-loader.js";
import { parseMarkdownBodySections } from "../../dist/src/loader/markdown-body-loader.js";
import { normalizeProfileDocument } from "../../dist/src/normalize/normalize-document.js";
import { buildPromptPlan } from "../../dist/src/plan/build-prompt-plan.js";
import { applyPromptProjection } from "../../dist/src/projection/apply-prompt-projection.js";
import { createTeamLibraryProjection } from "../../dist/src/runtime/index.js";
import { renderPromptPlan } from "../../dist/src/render/structural-renderer.js";

function createProjectionForTeam(team) {
  return createTeamLibraryProjection({ version: "test", teams: [team] });
}

function getProjectedAgent(team, agentId) {
  return createProjectionForTeam(team).agents.find((agent) => agent.sourceAgentId === agentId);
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
  };
}

test("loader rejects camelCase frontmatter keys", () => {
  assert.throws(
    () => loadProfileDocument({ id: "bad-agent", personaCore: { temperament: "bad" } }, "agent"),
    /only supports snake_case keys/i,
  );
});

test("prompt_projection paths must also be snake_case", () => {
  assert.throws(
    () =>
      loadProfileDocument(
        {
          id: "bad-agent",
          persona_core: { temperament: "steady" },
          prompt_projection: {
            include: ["personaCore"],
          },
        },
        "agent",
      ),
    /snake_case paths/i,
  );
});

test("markdown body sections are parsed and rendered through the generic pipeline", () => {
  const teamDocument = loadProfileDocument(
    {
      id: "doc-team",
      name: "DocTeam",
      version: "1.0.0",
      governance: {
        working_rules: ["Stay grounded"],
      },
      prompt_projection: {
        include: ["governance", "examples"],
      },
    },
    "team",
  );
  const agentDocument = loadProfileDocument(
    {
      id: "doc-agent",
      name: "DocAgent",
      persona_core: {
        temperament: "steady",
      },
      prompt_projection: {
        include: ["persona_core", "examples"],
      },
    },
    "agent",
  );
  agentDocument.bodySections = parseMarkdownBodySections(`## Examples\n- Good fit\n- Keep evidence`);

  const prompt = createOpenCodePromptFromDocuments({
    team: teamDocument,
    agent: agentDocument,
  });

  assert.match(prompt, /### Examples/);
  assert.match(prompt, /- Good fit/);
  assert.match(prompt, /- Keep evidence/);
});

test("generic normalize and catalog keep arbitrary blocks without schema", () => {
  const loaded = loadProfileDocument(
    {
      id: "generic-agent",
      name: "Generic Agent",
      custom_review_rules: ["Check callers"],
      decision_profile: {
        risk_mode: "balanced",
      },
    },
    "agent",
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

test("coding-leader prompt renders generic top-level sections with strong content", () => {
  const projected = getProjectedAgent(createEmbeddedCodingTeam(), "coding-leader");
  assert.ok(projected);

  const prompt = createOpenCodeAgentPrompt(projected);

  assert.match(prompt, /## Team Contract/);
  assert.match(prompt, /### Governance/);
  assert.match(prompt, /## Agent Contract/);
  assert.match(prompt, /### Persona Core/);
  assert.match(prompt, /### Responsibility Core/);
  assert.match(prompt, /### Execution Policy/);
  assert.match(prompt, /### Guardrails/);
  assert.match(prompt, /### Output Contract/);
  assert.match(prompt, /持续推进，解决问题；只有在真实不可推进时才提问/);
  assert.match(prompt, /默认自己持有主链路/);
  assert.match(prompt, /已完成：/);
  assert.doesNotMatch(prompt, /### Core Principle/);
});

test("coordination-leader prompt renders coordination-specific sections structurally", () => {
  const projected = getProjectedAgent(createEmbeddedCodingTeam(), "coordination-leader");
  assert.ok(projected);

  const prompt = createOpenCodeAgentPrompt(projected);

  assert.match(prompt, /### Execution Policy/);
  assert.match(prompt, /- Concern Escalation Policy:/);
  assert.match(prompt, /不直接承担主要实现工作/);
  assert.match(prompt, /### Operations/);
});

test("executor explorer reviewer and web researcher prompts all render", () => {
  const team = createEmbeddedCodingTeam();

  for (const agentId of ["coding-executor", "codebase-explorer", "reviewer", "web-researcher"]) {
    const projected = getProjectedAgent(team, agentId);
    assert.ok(projected, `expected projected agent ${agentId}`);

    const prompt = createOpenCodeAgentPrompt(projected);
    assert.match(prompt, /## Agent Contract/);
    assert.ok(prompt.length > 300, `${agentId} prompt should not be trivial`);
  }
});

test("promptProjection include exclude labels works on generic path tree", () => {
  const loaded = loadProfileDocument(
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
    "agent",
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
    promptProjection: {
      include: ["execution_policy", "metadata.id"],
      labels: {
        execution_policy: "Decision Model",
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
  assert.match(prompt, /### Metadata/);
});
