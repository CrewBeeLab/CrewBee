import { existsSync } from "node:fs";
import path from "node:path";

import { loadDefaultTeamLibrary, summarizeTeamDiagnostics, validateTeamLibrary } from "../agent-teams";
import { createOpenCodeBootstrap } from "../adapters/opencode/bootstrap";
import { DEFAULT_OPENCODE_EXECUTION_MODE } from "../adapters/opencode/defaults";

import { findCrewBeePluginEntries, readOpenCodeConfig } from "./opencode-config-file";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { detectOpenCodeCli } from "./opencode-cli";
import {
  createCanonicalPluginEntry,
  detectInstalledPackageRoot,
  detectInstalledPluginPath,
  resolveLegacyInstalledPackageRoot,
  resolvePackageWorkspaceRoot,
} from "./plugin-entry";
import type { DoctorOptions, DoctorResult } from "./types";

function isValidCrewBeeConfigEntry(entry: string, expectedPluginEntry: string): boolean {
  return entry === expectedPluginEntry || entry === `${expectedPluginEntry}@latest`;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const projectWorktree = path.resolve(options.projectWorktree ?? process.cwd());
  const expectedPluginEntry = createCanonicalPluginEntry(installRoot);
  const installedPackageRoot = detectInstalledPackageRoot(installRoot);
  const opencode = detectOpenCodeCli();
  const packageWorkspaceRoot = resolvePackageWorkspaceRoot(installRoot);
  const hasLegacyInstalledPackage = existsSync(path.join(resolveLegacyInstalledPackageRoot(installRoot), "package.json"));
  const currentPluginEntries = findCrewBeePluginEntries(readOpenCodeConfig(configPath).config);
  const teamLibrary = loadDefaultTeamLibrary({
    globalConfigRoot: path.dirname(configPath),
    projectWorktree,
  });
  const teamIssues = validateTeamLibrary(teamLibrary);
  const teamDiagnostics = summarizeTeamDiagnostics(teamIssues);
  const boot = createOpenCodeBootstrap({
    teamLibrary,
    defaults: { defaultMode: DEFAULT_OPENCODE_EXECUTION_MODE },
  });
  const hasWorkspaceManifest = existsSync(path.join(packageWorkspaceRoot, "package.json"));
  const configMatchesCanonical = currentPluginEntries.length === 1 && isValidCrewBeeConfigEntry(currentPluginEntries[0] ?? "", expectedPluginEntry);
  const hasInstalledPackage = existsSync(path.join(installedPackageRoot, "package.json"));
  const hasPluginFile = existsSync(detectInstalledPluginPath(installRoot));
  const teamHealthy = teamDiagnostics.healthy;
  const healthy = opencode.found && hasWorkspaceManifest && hasInstalledPackage && hasPluginFile && configMatchesCanonical && teamHealthy;

  return {
    configMatchesCanonical,
    configPath,
    currentPluginEntries,
    expectedPluginEntry,
    hasInstalledPackage,
    hasPluginFile,
    hasLegacyInstalledPackage,
    hasWorkspaceManifest,
    healthy,
    installedPackageRoot,
    installRoot,
    opencodeFound: opencode.found,
    opencodePath: opencode.path,
    opencodeVersion: opencode.version,
    projectWorktree,
    blockingTeamIssueCount: teamDiagnostics.blockingIssueCount,
    teamCount: teamLibrary.teams.length,
    teamHealthy,
    teamIssues,
    modelResolution: boot.projectedAgents.map((agent) => agent.modelResolution),
  };
}
