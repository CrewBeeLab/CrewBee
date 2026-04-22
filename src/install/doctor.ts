import { existsSync } from "node:fs";
import path from "node:path";

import { findCrewBeePluginEntries, readOpenCodeConfig } from "./config-writer";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { createCanonicalPluginEntry, detectInstalledPackageRoot, detectInstalledPluginPath } from "./plugin-entry";
import type { DoctorOptions, DoctorResult } from "./types";

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const expectedPluginEntry = createCanonicalPluginEntry(installRoot);
  const installedPackageRoot = detectInstalledPackageRoot(installRoot);
  const currentPluginEntries = findCrewBeePluginEntries(readOpenCodeConfig(configPath).config);
  const hasWorkspaceManifest = existsSync(path.join(installRoot, "package.json"));
  const hasPackageCacheRoot = existsSync(path.join(installRoot, "packages"));
  const hasInstalledPackage = existsSync(path.join(installedPackageRoot, "package.json"));
  const hasPluginFile = existsSync(detectInstalledPluginPath(installRoot));
  const configMatchesCanonical = currentPluginEntries.length === 1 && currentPluginEntries[0] === expectedPluginEntry;
  const healthy = (hasWorkspaceManifest || hasPackageCacheRoot) && hasInstalledPackage && hasPluginFile && configMatchesCanonical;

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
  };
}
