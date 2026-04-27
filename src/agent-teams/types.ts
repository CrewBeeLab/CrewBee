export interface TeamValidationIssue {
  level: "error" | "warning";
  message: string;
  filePath?: string;
  blocking?: boolean;
}
