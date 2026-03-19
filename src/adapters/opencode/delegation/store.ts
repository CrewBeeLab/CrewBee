import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveInstallRoot } from "../../../install/install-root";

import type {
  ContinuityState,
  DelegateCheckpoint,
  DelegateStateData,
  DelegateTaskRecord,
  DelegateBackgroundStatus,
  DelegatedSessionRecord,
  TodoSnapshot,
} from "./types";

function createEmptyState(): DelegateStateData {
  return {
    version: 1,
    tasks: {},
    sessions: {},
    continuity: {},
  };
}

function createStatePath(worktree: string): string {
  const hash = createHash("sha1").update(worktree).digest("hex");
  return path.join(resolveInstallRoot(), "runtime", `${hash}.json`);
}

export class DelegateStateStore {
  private readonly filePath: string;
  private cache?: DelegateStateData;

  constructor(worktree: string) {
    this.filePath = createStatePath(worktree);
  }

  createTaskRef(): string {
    return `cbt_${randomUUID()}`;
  }

  getTask(taskRef: string): DelegateTaskRecord | undefined {
    return this.read().tasks[taskRef];
  }

  getTaskBySession(sessionID: string): DelegateTaskRecord | undefined {
    const state = this.read();
    const taskRef = state.sessions[sessionID]?.lastTaskRef;
    if (taskRef) {
      return state.tasks[taskRef];
    }

    return Object.values(state.tasks).find((task) => task.sessionID === sessionID);
  }

  getTasksByParent(parentSessionID: string): DelegateTaskRecord[] {
    return Object.values(this.read().tasks).filter((task) => task.parentSessionID === parentSessionID);
  }

  putTask(task: DelegateTaskRecord): void {
    const state = this.read();
    state.tasks[task.taskRef] = task;
    const session = state.sessions[task.sessionID];
    if (session) {
      state.sessions[task.sessionID] = { ...session, lastTaskRef: task.taskRef };
    }
    this.write(state);
  }

  updateTask(taskRef: string, patch: Partial<DelegateTaskRecord>): DelegateTaskRecord | undefined {
    const state = this.read();
    const task = state.tasks[taskRef];
    if (!task) {
      return undefined;
    }

    state.tasks[taskRef] = { ...task, ...patch, lastUpdateAt: Date.now() };
    this.write(state);
    return state.tasks[taskRef];
  }

  setTaskStatus(taskRef: string, status: DelegateBackgroundStatus, patch: Partial<DelegateTaskRecord> = {}): DelegateTaskRecord | undefined {
    return this.updateTask(taskRef, {
      ...patch,
      status,
      completedAt: status === "completed" || status === "failed" || status === "cancelled" ? Date.now() : undefined,
    });
  }

  putSession(record: DelegatedSessionRecord): void {
    const state = this.read();
    state.sessions[record.sessionID] = record;
    this.write(state);
  }

  getSession(sessionID: string): DelegatedSessionRecord | undefined {
    return this.read().sessions[sessionID];
  }

  setCheckpoint(sessionID: string, checkpoint: DelegateCheckpoint): void {
    const state = this.read();
    const current = state.continuity[sessionID] ?? {};
    state.continuity[sessionID] = { ...current, checkpoint };
    this.write(state);
  }

  getCheckpoint(sessionID: string): DelegateCheckpoint | undefined {
    return this.read().continuity[sessionID]?.checkpoint;
  }

  setTodos(sessionID: string, todos: TodoSnapshot[]): void {
    const state = this.read();
    const current = state.continuity[sessionID] ?? {};
    state.continuity[sessionID] = { ...current, todos };
    this.write(state);
  }

  getTodos(sessionID: string): TodoSnapshot[] {
    return this.read().continuity[sessionID]?.todos ?? [];
  }

  markCompacted(sessionID: string): void {
    const state = this.read();
    const current = state.continuity[sessionID] ?? {};
    state.continuity[sessionID] = { ...current, compactedAt: Date.now(), noTextTailCount: 0 };
    this.write(state);
  }

  getContinuity(sessionID: string): ContinuityState {
    return this.read().continuity[sessionID] ?? {};
  }

  setNoTextTailCount(sessionID: string, count: number): void {
    const state = this.read();
    const current = state.continuity[sessionID] ?? {};
    state.continuity[sessionID] = { ...current, noTextTailCount: count };
    this.write(state);
  }

  clearSession(sessionID: string): void {
    const state = this.read();
    delete state.sessions[sessionID];
    delete state.continuity[sessionID];
    this.write(state);
  }

  private read(): DelegateStateData {
    if (this.cache) {
      return this.cache;
    }

    if (!existsSync(this.filePath)) {
      this.cache = createEmptyState();
      return this.cache;
    }

    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DelegateStateData>;
    this.cache = {
      version: 1,
      tasks: parsed.tasks ?? {},
      sessions: parsed.sessions ?? {},
      continuity: parsed.continuity ?? {},
    };
    return this.cache;
  }

  private write(state: DelegateStateData): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.cache = state;
    writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}
