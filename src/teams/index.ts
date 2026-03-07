import type { TeamLibrary, TeamRoleSpec, TeamSpec } from "../core";

export const CODING_TEAM_ID = "coding-team";
export const GENERAL_TEAM_ID = "general-team";
export const WUKONG_TEAM_ID = "wukong-team";

function createLeader(id: string, name: string, responsibility: string): TeamRoleSpec {
  return {
    id,
    name,
    kind: "leader",
    responsibility,
  };
}

function createMember(id: string, name: string, responsibility: string): TeamRoleSpec {
  return {
    id,
    name,
    kind: "member",
    responsibility,
  };
}

export const baselineTeams: TeamSpec[] = [
  {
    id: CODING_TEAM_ID,
    name: "Coding Team",
    description: "Code delivery team for implementation, debugging, review, and verification.",
    scene: "coding",
    leader: createLeader(
      "tech-lead",
      "Tech Lead",
      "Receives coding tasks, delegates by default, and converges the final delivery.",
    ),
    members: [
      createMember("planner", "Planner", "Breaks down coding tasks into a light execution plan."),
      createMember("scout", "Scout", "Reads the codebase, finds entry points, and surfaces implementation clues."),
      createMember("builder", "Builder", "Implements the required code changes."),
      createMember("reviewer", "Reviewer", "Checks solution quality and consistency."),
      createMember("verifier", "Verifier", "Runs validation, tests, and final checks."),
    ],
    workflow: {
      id: "coding-default",
      name: "Coding default workflow",
      stages: ["intake", "locate", "plan-or-delegate", "implement", "verify", "summarize"],
    },
    toolDomains: [
      {
        id: "repo-tools",
        enabledByDefault: true,
        description: "Repository inspection, editing, and validation tools.",
      },
    ],
    outputRequirements: [
      {
        id: "implementation-summary",
        description: "Summarize the change and where it was made.",
      },
      {
        id: "verification-results",
        description: "Report verification evidence such as typecheck, tests, or build status.",
      },
    ],
    delegateFirst: true,
    collaborationStyle: "Use the smallest coordination needed; avoid unnecessary multi-agent ritual on simple coding tasks.",
  },
  {
    id: GENERAL_TEAM_ID,
    name: "General Team",
    description: "General-purpose team for research, analysis, writing, and operational tasks.",
    scene: "general",
    leader: createLeader(
      "task-lead",
      "Task Lead",
      "Receives general tasks, delegates by default, and consolidates the final response.",
    ),
    members: [
      createMember("researcher", "Researcher", "Collects information and organizes source material."),
      createMember("analyst", "Analyst", "Builds structure, comparisons, and reasoning."),
      createMember("writer", "Writer", "Produces the primary draft or response."),
      createMember("editor", "Editor", "Compresses, polishes, and sharpens expression."),
      createMember("operator", "Operator", "Executes task checklists and operational steps."),
    ],
    workflow: {
      id: "general-default",
      name: "General default workflow",
      stages: ["intake", "clarify", "research-or-analyze", "draft-or-execute", "check", "summarize"],
    },
    toolDomains: [
      {
        id: "knowledge-tools",
        enabledByDefault: true,
        description: "Research, comparison, and writing-support tools.",
      },
    ],
    outputRequirements: [
      {
        id: "result-summary",
        description: "Summarize the final answer, decision, or execution result.",
      },
    ],
    delegateFirst: true,
    collaborationStyle: "Favor clarity and useful synthesis over coding-specific ceremony.",
  },
  {
    id: WUKONG_TEAM_ID,
    name: "Wukong Team",
    description: "Exploration-oriented team for complex, uncertain, and long-cycle tasks.",
    scene: "exploration",
    leader: createLeader(
      "wukong",
      "Sun Wukong",
      "Leads difficult exploratory work, opens paths quickly, and breaks through blockers.",
    ),
    members: [
      createMember("tripitaka", "Tang Sanzang", "Keeps mission intent and long-horizon direction stable."),
      createMember("bajie", "Zhu Bajie", "Challenges plans with grounded tradeoff pressure and practicality."),
      createMember("wujing", "Sha Wujing", "Provides execution steadiness and reliable follow-through."),
      createMember("white-dragon", "White Dragon Horse", "Carries context and keeps multi-step progress moving."),
    ],
    workflow: {
      id: "wukong-default",
      name: "Wukong default workflow",
      stages: ["make-vow", "explore", "borrow-strength", "break-through", "clear-gate", "review"],
    },
    toolDomains: [
      {
        id: "exploration-tools",
        enabledByDefault: true,
        description: "Search, investigation, and long-cycle coordination tools.",
      },
    ],
    outputRequirements: [
      {
        id: "progress-summary",
        description: "Summarize exploratory progress and open paths.",
      },
      {
        id: "review-notes",
        description: "Record lessons, risks, and next-step guidance.",
      },
    ],
    delegateFirst: true,
    collaborationStyle: "Embrace exploration, borrowing strength, and staged breakthroughs for uncertain tasks.",
  },
];

export const baselineTeamLibrary: TeamLibrary = {
  version: "v1-draft",
  teams: baselineTeams,
};

export function findTeam(teamId: string): TeamSpec | undefined {
  return baselineTeams.find((team) => team.id === teamId);
}
