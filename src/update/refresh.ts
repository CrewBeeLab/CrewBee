import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import type { PluginInput } from "@opencode-ai/plugin";

import { logCrewBee } from "../adapters/opencode/logging";

import { findConfiguredCrewBeeReleaseIntent } from "./intent";
import { fetchTargetVersion } from "./registry";
import {
  acquireCrewBeeReleaseLock,
  readCrewBeeReleaseState,
  releaseCrewBeeReleaseLock,
  writeCrewBeeReleaseState,
} from "./state";
import { invalidateWorkspacePackage, readInstalledWorkspaceVersion, syncWorkspaceDependencyIntent } from "./workspace";

import type { CrewBeeReleaseCheckResult, CrewBeeReleaseRefreshDependencies } from "./types";

const FAILURE_RECHECK_MS = 30 * 60 * 1000;

export function startBackgroundReleaseRefresh(ctx: PluginInput, deps: CrewBeeReleaseRefreshDependencies = createDefaultDependencies()): void {
  if (!shouldEnableCrewBeeReleaseRefresh()) {
    return;
  }

  queueMicrotask(() => {
    void runBackgroundReleaseRefresh(ctx, deps).catch(() => undefined);
  });
}

export async function runBackgroundReleaseRefresh(ctx: PluginInput, deps: CrewBeeReleaseRefreshDependencies): Promise<CrewBeeReleaseCheckResult> {
  if (!acquireCrewBeeReleaseLock()) {
    await logCrewBee(ctx, "CrewBee release refresh skipped because another refresh is already running", undefined, "debug");
    return { needsRefresh: false, reason: "up-to-date" };
  }

  try {
  const intent = findConfiguredCrewBeeReleaseIntent();
  if (!intent) {
    await logCrewBee(ctx, "CrewBee release refresh skipped because plugin is not configured", undefined, "debug");
    return { needsRefresh: false, reason: "plugin-not-configured" };
  }

  if (intent.isPinned) {
    const currentVersion = readInstalledWorkspaceVersion(intent.workspaceRoot);
    await logCrewBee(ctx, "CrewBee release refresh skipped for pinned version", {
      entry: intent.entry,
      pinnedVersion: intent.requestedVersion,
      currentVersion,
    });
    return { currentVersion, latestVersion: intent.requestedVersion, needsRefresh: false, reason: "pinned-version" };
  }

  const state = readCrewBeeReleaseState();
  const now = Date.now();
  const currentVersion = readInstalledWorkspaceVersion(intent.workspaceRoot) ?? state.lastKnownVersion;

  const latestVersion = await fetchTargetVersion({ intent, fetchJson: deps.fetchJson });
  if (!latestVersion) {
    writeCrewBeeReleaseState({
      ...state,
      lastCheckedAt: now,
    });
    await logCrewBee(ctx, "CrewBee release refresh could not resolve latest version", {
      entry: intent.entry,
      channel: intent.channel,
      currentVersion,
    }, "warn");
    return { currentVersion, needsRefresh: false, reason: "latest-unavailable" };
  }

  if (currentVersion === latestVersion) {
    writeCrewBeeReleaseState({
      ...state,
      lastCheckedAt: now,
      lastKnownVersion: currentVersion,
      lastFailure: undefined,
      lastFailureAt: undefined,
      lastSucceededAt: now,
    });
    await logCrewBee(ctx, "CrewBee release refresh found current version already up to date", {
      currentVersion,
      latestVersion,
      workspaceRoot: intent.workspaceRoot,
    }, "debug");
    return { currentVersion, latestVersion, needsRefresh: false, reason: "up-to-date" };
  }

  if (shouldSkipFailedTargetByCooldown(state, now, latestVersion)) {
    await logCrewBee(ctx, "CrewBee release refresh skipped by failure cooldown", {
      currentVersion,
      latestVersion,
      lastCheckedAt: state.lastCheckedAt,
      lastFailureAt: state.lastFailureAt,
    }, "debug");
    return { currentVersion, latestVersion, needsRefresh: true, reason: "refresh-required" };
  }

  await logCrewBee(ctx, "CrewBee release refresh found newer version", {
    currentVersion,
    latestVersion,
    workspaceRoot: intent.workspaceRoot,
    entry: intent.entry,
  });

  syncWorkspaceDependencyIntent(intent, latestVersion);
  invalidateWorkspacePackage(intent);
  const installed = await deps.runInstall(intent.workspaceRoot);

  if (!installed) {
    writeCrewBeeReleaseState({
      ...state,
      lastCheckedAt: now,
      lastAttemptedVersion: latestVersion,
      lastFailure: `Failed to install ${latestVersion}`,
      lastFailureAt: now,
      lastKnownVersion: currentVersion,
    });
    await logCrewBee(ctx, "CrewBee release refresh failed to install latest version", {
      currentVersion,
      latestVersion,
      workspaceRoot: intent.workspaceRoot,
    }, "warn");
    return { currentVersion, latestVersion, needsRefresh: true, reason: "refresh-required" };
  }

  writeCrewBeeReleaseState({
    lastCheckedAt: now,
    lastAttemptedVersion: latestVersion,
    lastKnownVersion: latestVersion,
    lastFailure: undefined,
    lastFailureAt: undefined,
    lastSucceededAt: now,
  });
  await logCrewBee(ctx, "CrewBee release refresh installed newer version", {
    currentVersion,
    latestVersion,
    workspaceRoot: intent.workspaceRoot,
  });

  return { currentVersion, latestVersion, needsRefresh: true, reason: "refresh-required" };
  } finally {
    releaseCrewBeeReleaseLock();
  }
}

export function shouldEnableCrewBeeReleaseRefresh(currentPackageRoot: string = resolveCurrentPackageRoot()): boolean {
  const override = process.env.CREWBEE_AUTO_UPDATE?.trim().toLowerCase();
  if (override === "1" || override === "true" || override === "on") {
    return true;
  }
  if (override === "0" || override === "false" || override === "off") {
    return false;
  }
  if (process.env.NODE_ENV === "test") {
    return false;
  }
  return !existsSync(path.join(currentPackageRoot, ".git"));
}

function shouldSkipFailedTargetByCooldown(state: ReturnType<typeof readCrewBeeReleaseState>, now: number, latestVersion: string): boolean {
  return Boolean(
    state.lastFailureAt
    && state.lastAttemptedVersion === latestVersion
    && now - state.lastFailureAt < FAILURE_RECHECK_MS,
  );
}

function resolveCurrentPackageRoot(): string {
  return path.resolve(__dirname, "../..");
}

function createDefaultDependencies(): CrewBeeReleaseRefreshDependencies {
  return {
    async fetchJson(url: string) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
      return response.json();
    },
    async runInstall(workspaceRoot: string) {
      return new Promise<boolean>((resolve) => {
        const child = spawn("npm", ["install", "--prefix", workspaceRoot, "--no-audit", "--no-fund"], {
          shell: process.platform === "win32",
          stdio: "ignore",
        });

        child.on("error", () => resolve(false));
        child.on("exit", (code) => resolve(code === 0));
      });
    },
  };
}
