import type { AgentTeamDefinition, TeamPolicySpec } from "../core";

/** Loading-only shape. Composition must supply a policy before projection. */
export interface TeamSourceDefinition extends Omit<AgentTeamDefinition, "policy"> {
  policy?: TeamPolicySpec;
}

export interface TeamValidationIssue {
  level: "error" | "warning";
  message: string;
  code?: string;
  filePath?: string;
  path?: string;
  suggestion?: string;
  blocking?: boolean;
  fixable?: boolean;
  sourceScope?: "project" | "global";
}
