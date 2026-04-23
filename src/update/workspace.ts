import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CrewBeeReleaseIntent } from "./types";

export function readInstalledWorkspaceVersion(workspaceRoot: string): string | undefined {
  const manifestPath = path.join(workspaceRoot, "node_modules", "crewbee", "package.json");
  if (!existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

export function syncWorkspaceDependencyIntent(intent: CrewBeeReleaseIntent, targetVersion: string): { changed: boolean } {
  const packageJsonPath = path.join(intent.workspaceRoot, "package.json");
  const desiredVersion = intent.isPinned ? intent.requestedVersion : targetVersion;
  const current = readWorkspacePackageJson(packageJsonPath);

  const next = {
    ...current,
    private: true,
    name: current.name ?? `${intent.packageName}-release-workspace`,
    version: current.version ?? "0.0.0",
    dependencies: {
      ...(current.dependencies ?? {}),
      [intent.packageName]: desiredVersion,
    },
  };
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  if (changed) {
    mkdirSync(intent.workspaceRoot, { recursive: true });
    writeFileSync(packageJsonPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  return { changed };
}

export function invalidateWorkspacePackage(intent: CrewBeeReleaseIntent): boolean {
  const packageRoot = path.join(intent.workspaceRoot, "node_modules", intent.packageName);
  const lockPath = path.join(intent.workspaceRoot, "package-lock.json");
  let changed = false;

  if (existsSync(packageRoot)) {
    rmSync(packageRoot, { recursive: true, force: true });
    changed = true;
  }

  if (existsSync(lockPath)) {
    rmSync(lockPath, { force: true });
    changed = true;
  }

  return changed;
}

function readWorkspacePackageJson(packageJsonPath: string): {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
} {
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
