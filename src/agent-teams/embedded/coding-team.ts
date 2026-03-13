import type {
  AgentTeamDefinition,
  TeamManifest,
} from "../../core";

import { createCodingTeamAgents } from "./coding-team/agents";

export function createEmbeddedCodingTeam(): AgentTeamDefinition {
  const manifest: TeamManifest = {
    id: "coding-team",
    kind: "agent-team",
    version: "1.0.0",
    name: "CodingTeam",
    status: "active",
    owner: "CrewBee",
    description: "以 coding-leader 为 formal leader、以主执行者为中心、由研究、评审与顾问按需支撑的代码工程团队。",
    mission: {
      objective: "以最少但足够的结构完成代码开发、修改、调试、重构、验证与工程交付。",
      successDefinition: [
        "主执行链路始终由单一 active owner 持有并推进到验证闭环",
        "仓库内研究、外部研究、独立评审与高阶顾问能力可按需支撑",
        "边界清晰的执行任务可交给纯执行角色高质量落地",
        "最终结果可交付、可验证、可解释",
      ],
    },
    scope: {
      inScope: [
        "代码开发与修改",
        "缺陷修复与调试",
        "局部至中等规模重构",
        "验证与工程交付",
        "编码相关架构与关键技术决策",
        "仓库内研究与外部研究",
      ],
      outOfScope: ["纯通用文档写作", "与代码无关的一般事务执行", "长期项目管理与非工程流程管理"],
    },
    leader: {
      agentRef: "coding-leader",
      responsibilities: [
        "接收用户任务",
        "持有默认主上下文并主导代码定位、轻量计划、实现路径与验证要求",
        "决定自执行、咨询、委派或升级",
        "对实现、评审、验证与最终汇报负责",
      ],
    },
    members: [
      {
        agentRef: "coordination-leader",
        role: "第二 Leader 风格；用于高模糊、多子任务、范围收束优先的开局；执行工作委托给 coding-executor",
      },
      {
        agentRef: "coding-executor",
        role: "纯执行叶子角色；用于边界清晰、无需复杂编排的实现、修复、调试与局部重构",
      },
      { agentRef: "codebase-explorer", role: "仓库内代码定位、调用链、模式与历史线索探索" },
      { agentRef: "web-researcher", role: "外部文档、开源实现、版本与历史研究" },
      { agentRef: "reviewer", role: "独立评审与质量刹车" },
      { agentRef: "principal-advisor", role: "高风险架构、安全、性能与复杂技术决策顾问" },
      { agentRef: "multimodal-looker", role: "多模态材料解读与定向提取" },
    ],
    workflow: {
      id: "coding-default",
      name: "Coding default workflow",
      stages: ["接单", "代码定位与证据收集", "轻量计划或按需分派", "实现", "评审", "验证", "总结"],
    },
    governance: {
      instructionPrecedence: ["平台规则", "仓库规则", "团队规则", "Agent 规则", "任务规则"],
      approvalPolicy: {
        requiredFor: ["破坏性操作", "外部副作用", "代码提交（commit）"],
        allowAssumeFor: ["低风险实现细节"],
      },
      forbiddenActions: [
        "伪造证据",
        "未经验证宣称完成",
        "忽略硬约束",
        "假装读过未读代码",
        "未经明确批准压制类型错误",
      ],
      qualityFloor: {
        requiredChecks: ["诊断检查（diagnostics）", "构建检查（build）", "测试检查（tests）"],
        evidenceRequired: true,
      },
      workingRules: [
        "Leader 是主要入口",
        "同一时刻只允许一个 active owner 持有主上下文",
        "支援 Agent 必须向 Leader 或当前主执行 owner 回报",
        "任何委派或咨询都必须写清目标、范围、约束、交付与验证口径",
        "面向用户的最终总结必须由持有收口责任的角色给出",
        "非琐碎任务在宣称完成前必须经过评审",
        "叶子执行者必须自行验证；最终收口由 owner 统一完成",
        "仓库内研究与外部研究必须分离",
      ],
    },
    agentRuntime: {
      "coding-leader": { provider: "openai", model: "gpt-5.4", temperature: 0.2, topP: 0.85, variant: "long-context" },
      "coordination-leader": { provider: "openai", model: "gpt-5.4", temperature: 0.15, topP: 0.75 },
      "coding-executor": { provider: "openai", model: "gpt-5.4", temperature: 0.25, topP: 0.9 },
      "codebase-explorer": { provider: "openai", model: "gpt-5.4", temperature: 0.1, topP: 0.8 },
      "web-researcher": { provider: "openai", model: "gpt-5.4", temperature: 0.2, topP: 0.85 },
      reviewer: { provider: "openai", model: "gpt-5.4", temperature: 0.15, topP: 0.75 },
      "principal-advisor": { provider: "openai", model: "gpt-5.4", temperature: 0.15, topP: 0.75 },
      "multimodal-looker": { provider: "openai", model: "gpt-5.4", temperature: 0.2, topP: 0.85 },
    },
    tags: ["代码", "leader驱动", "上下文连续性", "主执行者中心", "评审中心", "证据驱动"],
    promptProjection: {
      include: ["mission", "workflow", "governance"],
    },
  };

  const agents = createCodingTeamAgents();

  return {
    manifest,
    agents,
  };
}
