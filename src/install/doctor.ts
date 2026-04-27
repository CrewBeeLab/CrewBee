import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadDefaultTeamLibrary, summarizeTeamDiagnostics, validateTeamLibrary } from "../agent-teams";

import { findCrewBeePluginEntries, readOpenCodeConfig } from "./config-writer";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { createCanonicalPluginEntry, detectInstalledPackageRoot, detectInstalledPluginPath } from "./plugin-entry";
import type { DoctorOptions, DoctorResult } from "./types";

function hasOpenCodeManagedCrewBeePackage(installRoot: string): boolean {
  const bunLockPath = path.join(installRoot, "bun.lock");
  if (existsSync(bunLockPath) && /["']crewbee["']\s*:\s*\[/.test(readFileSync(bunLockPath, "utf8"))) {
    return true;
  }

  const packageLockPath = path.join(installRoot, "package-lock.json");
  if (existsSync(packageLockPath) && readFileSync(packageLockPath, "utf8").includes('"node_modules/crewbee"')) {
    return true;
  }

  return false;
}

function isValidCrewBeeConfigEntry(entry: string, expectedPluginEntry: string): boolean {
  return entry === expectedPluginEntry || entry === `${expectedPluginEntry}@latest`;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const projectWorktree = path.resolve(options.projectWorktree ?? process.cwd());
  const expectedPluginEntry = createCanonicalPluginEntry(installRoot);
  const installedPackageRoot = detectInstalledPackageRoot(installRoot);
  const currentPluginEntries = findCrewBeePluginEntries(readOpenCodeConfig(configPath).config);
  const teamLibrary = loadDefaultTeamLibrary({
    globalConfigRoot: path.dirname(configPath),
    projectWorktree,
  });
  const teamIssues = validateTeamLibrary(teamLibrary);
  const teamDiagnostics = summarizeTeamDiagnostics(teamIssues);
  const hasWorkspaceManifest = existsSync(path.join(installRoot, "package.json"));
  const hasPackageCacheRoot = existsSync(path.join(installRoot, "packages"));
  const hasOpenCodeManagedPackage = hasOpenCodeManagedCrewBeePackage(installRoot);
  const configMatchesCanonical = currentPluginEntries.length === 1 && isValidCrewBeeConfigEntry(currentPluginEntries[0] ?? "", expectedPluginEntry);
  const hasInstalledPackage = existsSync(path.join(installedPackageRoot, "package.json")) || hasOpenCodeManagedPackage;
  const hasPluginFile = existsSync(detectInstalledPluginPath(installRoot)) || (hasOpenCodeManagedPackage && configMatchesCanonical);
  const teamHealthy = teamDiagnostics.healthy;
  const healthy = (hasWorkspaceManifest || hasPackageCacheRoot) && hasInstalledPackage && hasPluginFile && configMatchesCanonical && teamHealthy;

  return {
    configMatchesCanonical,
    configPath,
    currentPluginEntries,
    expectedPluginEntry,
    hasInstalledPackage,
    hasPluginFile,
    hasWorkspaceManifest,
    healthy,
    installedPackageRoot,
    installRoot,
    projectWorktree,
    blockingTeamIssueCount: teamDiagnostics.blockingIssueCount,
    teamCount: teamLibrary.teams.length,
    teamHealthy,
    teamIssues,
  };
}
