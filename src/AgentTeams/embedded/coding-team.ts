import type {
  AgentTeamDefinition,
  SharedCapabilities,
  TeamManifest,
  TeamPolicy,
} from "../../core";

import { createCodingTeamAgents } from "./coding-team/agents";

export function createEmbeddedCodingTeam(): AgentTeamDefinition {
  const manifest: TeamManifest = {
    id: "coding-team",
    kind: "agent-team",
    version: "1.0.0",
    name: "Coding Team",
    status: "active",
    owner: "AgentScroll",
    description: "面向代码实现、修复、重构与验证闭环的执行型团队，由 CodingLeader 作为 formal leader 与默认上下文 owner 收口。",
    mission: {
      objective: "通过 CodingLeader 持有主上下文的执行链路，将编码任务推进为可验证的交付结果。",
      successDefinition: [
        "用户请求的工程目标被完整满足，而不是停留在部分完成、基础版完成或只给方案。",
        "主要上下文始终由单一 active owner 持有，关键决策、实现和验证链路可解释。",
        "最终结果由 CodingLeader 统一对外汇报。",
      ],
    },
    scope: {
      inScope: ["implementation", "bug-fixes", "refactoring", "verification"],
      outOfScope: ["product strategy", "org-level governance"],
    },
    leader: {
      agentRef: "coding-leader",
      responsibilities: [
        "作为 Coding Team 的 formal leader 与默认 active owner 接收大多数 coding 任务。",
        "先探索后决策，必要时委派专项研究或边界清晰的叶子实现，但不外包主责任链。",
        "统一收拢实现结果、评审结论与验证证据后对外汇报。",
      ],
    },
    members: [
      { agentRef: "coding-executor", role: "直接实现与局部执行" },
      { agentRef: "management-leader", role: "范围收束与路径编排" },
      { agentRef: "reviewer", role: "质量审查与完成把关" },
      { agentRef: "principal-advisor", role: "高阶技术顾问" },
      { agentRef: "codebase-explorer", role: "代码库定位与调用链探索" },
      { agentRef: "web-researcher", role: "外部文档与开源研究" },
    ],
    modes: ["single-executor", "team-collaboration"],
    workingMode: {
      humanToLeaderOnly: true,
      leaderDrivenCoordination: true,
      agentCommunicationViaSessionContext: true,
      explicitRoutingFilesRequired: false,
      explicitContractFilesRequired: false,
    },
    workflow: {
      id: "coding-default",
      name: "Coding default workflow",
      stages: ["intake", "locate", "plan-or-delegate", "implement", "verify", "summarize"],
    },
    implementationBias: {
      namingMode: "responsibility-first",
      routingPriority: "responsibility-first",
      promptEmphasis: "responsibility-high / persona-low",
      displayEmphasis: "responsibility-high",
      personaVisibility: "low",
      responsibilityVisibility: "high",
    },
    sharedRefs: {
      policyRef: "coding-team.policy",
      capabilityRef: "coding-team.shared-capabilities",
    },
    tags: ["coding", "leader", "execution-first", "context-owner", "verification", "delegate-first"],
  };

  const policy: TeamPolicy = {
    id: "coding-team.policy",
    kind: "team-policy",
    version: "1.0.0",
    instructionPrecedence: ["platform", "repository", "team", "agent", "task"],
    approvalPolicy: {
      requiredFor: ["destructive-actions", "external-side-effects", "commit"],
      allowAssumeFor: ["low-risk-implementation-details"],
    },
    forbiddenActions: [
      "fabricate-evidence",
      "claim-done-without-verification",
      "ignore-hard-constraints",
      "pretend-to-have-read-unread-code",
      "outsource-main-responsibility-without-context-ownership",
    ],
    qualityFloor: {
      requiredChecks: ["diagnostics", "build", "tests"],
      evidenceRequired: true,
    },
    workingRules: [
      "leader-is-primary-interface",
      "leader-keeps-main-context-chain",
      "subordinate-agents-report-back-to-leader",
      "non-trivial-tasks-require-review-judgment-before-done",
      "delegated-work-returns-to-leader-for-unified-verification",
      "final-user-facing-summary-comes-from-leader",
    ],
    notes: [
      "Coding Team 默认将验证纳入主流程。",
      "简单任务不应被强行升级为重型多 Agent 编排。",
      "CodingLeader 默认把自己视为主执行 owner，而不是纯调度器。",
      "委派不能替代主链路 ownership，所有委派结果都要回到 Leader 做统一验证与收口。",
    ],
  };

  const sharedCapabilities: SharedCapabilities = {
    id: "coding-team.shared-capabilities",
    kind: "shared-capabilities",
    version: "1.0.0",
    models: {
      default: "coding-deep",
      available: ["coding-deep", "reasoning-high", "balanced-default", "exploration-high"],
    },
    tools: {
      defaultProfile: "coding-team-default",
      availableProfiles: ["coding-team-default", "repo-readonly", "repo-readwrite", "web-research", "research-readonly"],
    },
    skills: {
      shared: ["repo-search-toolkit", "external-research-toolkit", "verification-toolkit"],
    },
    instructionPacks: {
      shared: ["team-policy", "repo-policy"],
    },
    memory: {
      defaultProfile: "session-context-primary",
    },
    hooks: {
      defaultBundle: "coding-team-guardrails",
    },
    mcp: {
      sharedServers: [],
    },
  };

  const agents = createCodingTeamAgents();

  return {
    manifest,
    policy,
    sharedCapabilities,
    agents,
  };
}
