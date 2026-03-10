import type { AgentProfileSpec } from "../../../../core";

import { createCodebaseExplorerAgent } from "./codebase-explorer";
import { createCoordinationLeaderAgent } from "./coordination-leader";
import { createCodingExecutorAgent } from "./coding-executor";
import { createCodingLeaderAgent } from "./coding-leader";
import { createMultimodalLookerAgent } from "./multimodal-looker";
import { createPrincipalAdvisorAgent } from "./principal-advisor";
import { createReviewerAgent } from "./reviewer";
import { createWebResearcherAgent } from "./web-researcher";

export function createCodingTeamAgents(): AgentProfileSpec[] {
  return [
    createCodingLeaderAgent(),
    createCodingExecutorAgent(),
    createCoordinationLeaderAgent(),
    createReviewerAgent(),
    createPrincipalAdvisorAgent(),
    createMultimodalLookerAgent(),
    createCodebaseExplorerAgent(),
    createWebResearcherAgent(),
  ];
}
