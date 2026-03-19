import type {
  DelegateCancelResult,
  DelegateStatusResult,
  DelegateTaskErrorCode,
  DelegateTaskResult,
} from "./types";

function formatJson(value: object): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createFailedResult(sessionID: string, errorCode: DelegateTaskErrorCode, message: string): DelegateTaskResult {
  return {
    status: "failed",
    session_id: sessionID,
    message,
    error_code: errorCode,
    resume_supported: true,
  };
}

export function stringifyDelegateTaskResult(result: DelegateTaskResult): string {
  return formatJson(result);
}

export function stringifyDelegateStatusResult(result: DelegateStatusResult): string {
  return formatJson(result);
}

export function stringifyDelegateCancelResult(result: DelegateCancelResult): string {
  return formatJson(result);
}

export function parseDelegateTaskResult(output: string): DelegateTaskResult | undefined {
  try {
    const parsed = JSON.parse(output) as DelegateTaskResult;
    return parsed && typeof parsed === "object" && typeof parsed.session_id === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}
