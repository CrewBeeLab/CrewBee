import type { AgentProfileSpec } from "../../../../core";

import { createCodebaseExplorerAgent } from "./codebase-explorer";
import { createCodingExecutorAgent } from "./coding-executor";
import { createCodingLeaderAgent } from "./coding-leader";
import { createManagementLeaderAgent } from "./management-leader";
import { createMultimodalLookerAgent } from "./multimodal-looker";
import { createPrincipalAdvisorAgent } from "./principal-advisor";
import { createReviewerAgent } from "./reviewer";
import { createWebResearcherAgent } from "./web-researcher";

export function createCodingTeamAgents(): AgentProfileSpec[] {
  return [
    createCodingLeaderAgent(),
    createCodingExecutorAgent(),
    createManagementLeaderAgent(),
    createReviewerAgent(),
    createPrincipalAdvisorAgent(),
    createMultimodalLookerAgent(),
    createCodebaseExplorerAgent(),
    createWebResearcherAgent(),
  ];
}
