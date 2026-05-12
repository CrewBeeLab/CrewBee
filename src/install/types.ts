import type { TeamValidationIssue } from "../agent-teams/types";
import type { ModelResolutionTrace } from "../adapters/opencode/model-resolution";

export type InstallSource = "local" | "registry";

export interface InstallCommandOptions {
  channel?: "stable" | "next";
  configPath?: string;
  dryRun: boolean;
  force?: boolean;
  installRoot?: string;
  localTarballPath?: string;
  source: InstallSource;
  yes?: boolean;
}

export interface InstallCommandContext {
  cwd: string;
  packageRoot: string;
}

export interface InstallResult {
  backupPath?: string;
  configChanged: boolean;
  configPath: string;
  crewbeeConfigChanged: boolean;
  crewbeeConfigPath: string;
  crewbeeConfigReason: "created-default" | "repaired-invalid" | "added-default-coding-team" | "migrated-config-version" | "unchanged";
  dryRun: boolean;
  installRoot: string;
  packageWorkspaceRoot: string;
  legacyPackageRemoved: boolean;
  migratedEntries: string[];
  pluginEntry: string;
  packageSpec?: string;
  source: InstallSource;
  tarballPath?: string;
  workspaceCreated: boolean;
}

export interface SetupOptions {
  channel?: "stable" | "next";
  configPath?: string;
  doctor: boolean;
  dryRun: boolean;
  force?: boolean;
  installRoot?: string;
  verbose?: boolean;
  withOpenCode: boolean;
  yes?: boolean;
}

export interface SetupResult {
  doctorResult?: DoctorResult;
  doctorRun: boolean;
  dryRun: boolean;
  installResult: InstallResult;
  opencodeFound: boolean;
  opencodeInstallAttempted: boolean;
  opencodeInstallCommand?: string;
  opencodePath?: string;
  opencodeVersion?: string;
  withOpenCode: boolean;
}

export interface UninstallOptions {
  configPath?: string;
  dryRun: boolean;
  installRoot?: string;
}

export interface UninstallResult {
  backupPath?: string;
  configChanged: boolean;
  configPath: string;
  dryRun: boolean;
  installRoot: string;
  packageRemoved: boolean;
  removedEntries: string[];
}

export interface DoctorOptions {
  configPath?: string;
  installRoot?: string;
  projectWorktree?: string;
}

export interface DoctorResult {
  configMatchesCanonical: boolean;
  configPath: string;
  currentPluginEntries: string[];
  expectedPluginEntry: string;
  hasInstalledPackage: boolean;
  hasPluginFile: boolean;
  hasLegacyInstalledPackage: boolean;
  hasWorkspaceManifest: boolean;
  healthy: boolean;
  installedPackageRoot: string;
  installRoot: string;
  opencodeFound: boolean;
  opencodePath?: string;
  opencodeVersion?: string;
  projectWorktree: string;
  blockingTeamIssueCount: number;
  teamCount: number;
  teamHealthy: boolean;
  teamIssues: TeamValidationIssue[];
  modelResolution: ModelResolutionTrace[];
}
