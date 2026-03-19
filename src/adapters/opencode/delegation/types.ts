import type { OpenCodeAgentConfig } from "../projection";

export type DelegateMode = "foreground" | "background";
export type DelegateTaskStatus = "running" | "completed" | "failed";
export type DelegateBackgroundStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type DelegateTaskErrorCode =
  | "missing_agent"
  | "unknown_agent"
  | "invalid_session_id"
  | "agent_session_mismatch"
  | "unsupported_mode"
  | "self_delegate_forbidden";

export interface DelegateTaskArgs {
  agent?: string;
  prompt: string;
  session_id?: string;
  mode?: DelegateMode;
}

export interface DelegateTaskResult {
  status: DelegateTaskStatus;
  session_id: string;
  task_ref?: string;
  message?: string;
  error_code?: DelegateTaskErrorCode;
  resume_supported?: boolean;
  resume_hint?: string;
}

export interface DelegateStatusArgs {
  task_ref: string;
}

export interface DelegateStatusResult {
  status: DelegateBackgroundStatus;
  session_id?: string;
  task_ref: string;
  message?: string;
}

export interface DelegateCancelArgs {
  task_ref: string;
}

export interface DelegateCancelResult {
  ok: boolean;
  task_ref: string;
  session_id?: string;
  message: string;
}

export interface DelegatePromptModel {
  providerID: string;
  modelID: string;
}

export interface DelegateCheckpoint {
  agent: string;
  sourceAgentId?: string;
  model?: DelegatePromptModel;
  tools: string[];
}

export interface TodoSnapshot {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high";
}

export interface DelegatedSessionRecord {
  sessionID: string;
  parentSessionID: string;
  sourceAgentId: string;
  configKey: string;
  lastTaskRef?: string;
}

export interface DelegateTaskRecord {
  taskRef: string;
  sessionID: string;
  parentSessionID: string;
  parentMessageID: string;
  sourceAgentId: string;
  configKey: string;
  description: string;
  status: DelegateBackgroundStatus;
  startedAt: number;
  completedAt?: number;
  lastError?: string;
  lastUpdateAt: number;
  message?: string;
  anchor: number;
}

export interface ContinuityState {
  checkpoint?: DelegateCheckpoint;
  todos?: TodoSnapshot[];
  compactedAt?: number;
  noTextTailCount?: number;
}

export interface DelegateStateData {
  version: 1;
  tasks: Record<string, DelegateTaskRecord>;
  sessions: Record<string, DelegatedSessionRecord>;
  continuity: Record<string, ContinuityState>;
}

export interface ResolvedDelegateAgent {
  agent: OpenCodeAgentConfig;
  configKey: string;
  sourceAgentId: string;
}
