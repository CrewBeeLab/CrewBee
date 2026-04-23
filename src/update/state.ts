import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveInstallRoot } from "../install";

export interface CrewBeeReleaseState {
  lastCheckedAt?: number;
  lastKnownVersion?: string;
  lastAttemptedVersion?: string;
  lastFailure?: string;
  lastFailureAt?: number;
  lastSucceededAt?: number;
}

export function readCrewBeeReleaseState(): CrewBeeReleaseState {
  const filePath = resolveReleaseStatePath();
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed as CrewBeeReleaseState : {};
  } catch {
    return {};
  }
}

export function writeCrewBeeReleaseState(state: CrewBeeReleaseState): void {
  const filePath = resolveReleaseStatePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function acquireCrewBeeReleaseLock(): boolean {
  const filePath = resolveReleaseLockPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    writeFileSync(filePath, String(Date.now()), { encoding: "utf8", flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export function releaseCrewBeeReleaseLock(): void {
  const filePath = resolveReleaseLockPath();
  if (!existsSync(filePath)) {
    return;
  }
  try {
    unlinkSync(filePath);
  } catch {
    // ignore cleanup failures
  }
}

function resolveReleaseStatePath(): string {
  return path.join(resolveInstallRoot(), "crewbee-release-state.json");
}

function resolveReleaseLockPath(): string {
  return path.join(resolveInstallRoot(), "crewbee-release-refresh.lock");
}
