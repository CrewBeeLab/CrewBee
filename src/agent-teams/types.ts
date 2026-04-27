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
