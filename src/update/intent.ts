import path from "node:path";

import { readOpenCodeConfig, resolveInstallRoot, resolveOpenCodeConfigPath } from "../install";

import type { CrewBeeReleaseIntent } from "./types";

const EXACT_SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
const CREWBEE_PACKAGE_NAME = "crewbee";

export function findConfiguredCrewBeeReleaseIntent(): CrewBeeReleaseIntent | undefined {
  const configPath = resolveOpenCodeConfigPath();
  const config = readOpenCodeConfig(configPath).config;
  const plugins = Array.isArray(config.plugin) ? config.plugin : [];

  for (const entry of plugins) {
    if (typeof entry !== "string") {
      continue;
    }

    if (entry === CREWBEE_PACKAGE_NAME) {
      return {
        configPath,
        entry,
        packageName: CREWBEE_PACKAGE_NAME,
        requestedVersion: "latest",
        channel: "latest",
        isPinned: false,
        workspaceRoot: resolveReleaseWorkspaceRoot(entry),
      };
    }

    if (entry.startsWith(`${CREWBEE_PACKAGE_NAME}@`)) {
      const requestedVersion = entry.slice(CREWBEE_PACKAGE_NAME.length + 1).trim();
      if (!requestedVersion) {
        continue;
      }

      return {
        configPath,
        entry,
        packageName: CREWBEE_PACKAGE_NAME,
        requestedVersion,
        channel: EXACT_SEMVER_REGEX.test(requestedVersion) ? "latest" : requestedVersion,
        isPinned: EXACT_SEMVER_REGEX.test(requestedVersion),
        workspaceRoot: resolveReleaseWorkspaceRoot(entry),
      };
    }
  }

  return undefined;
}

function resolveReleaseWorkspaceRoot(entry: string): string {
  return path.join(resolveInstallRoot(), "packages", sanitizePackageSpec(entry === CREWBEE_PACKAGE_NAME ? "crewbee@latest" : entry));
}

function sanitizePackageSpec(value: string): string {
  const illegal = process.platform === "win32" ? new Set(["<", ">", ":", '"', "|", "?", "*"]) : undefined;
  if (!illegal) {
    return value;
  }

  return Array.from(value, (char) => (illegal.has(char) || char.charCodeAt(0) < 32 ? "_" : char)).join("");
}
