export type InstallSource = "local" | "registry";

export interface InstallCommandOptions {
  configPath?: string;
  dryRun: boolean;
  installRoot?: string;
  localTarballPath?: string;
  source: InstallSource;
}

export interface InstallCommandContext {
  cwd: string;
  packageRoot: string;
}

export interface InstallResult {
  configChanged: boolean;
  configPath: string;
  dryRun: boolean;
  installRoot: string;
  migratedEntries: string[];
  pluginEntry: string;
  source: InstallSource;
  tarballPath?: string;
  workspaceCreated: boolean;
}

export interface UninstallOptions {
  configPath?: string;
  dryRun: boolean;
  installRoot?: string;
}

export interface UninstallResult {
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
}

export interface DoctorResult {
  configMatchesCanonical: boolean;
  configPath: string;
  currentPluginEntries: string[];
  expectedPluginEntry: string;
  hasInstalledPackage: boolean;
  hasPluginFile: boolean;
  hasWorkspaceManifest: boolean;
  healthy: boolean;
  installRoot: string;
}
