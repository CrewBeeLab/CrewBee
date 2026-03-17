import { existsSync } from "node:fs";
import path from "node:path";

import { findCrewBeePluginEntries, readOpenCodeConfig } from "./config-writer";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { createCanonicalPluginEntry, resolveInstalledPackageRoot, resolveInstalledPluginPath } from "./plugin-entry";
import type { DoctorOptions, DoctorResult } from "./types";

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const expectedPluginEntry = createCanonicalPluginEntry(installRoot);
  const currentPluginEntries = findCrewBeePluginEntries(readOpenCodeConfig(configPath).config);
  const hasWorkspaceManifest = existsSync(path.join(installRoot, "package.json"));
  const hasInstalledPackage = existsSync(path.join(resolveInstalledPackageRoot(installRoot), "package.json"));
  const hasPluginFile = existsSync(resolveInstalledPluginPath(installRoot));
  const configMatchesCanonical = currentPluginEntries.length === 1 && currentPluginEntries[0] === expectedPluginEntry;
  const healthy = hasWorkspaceManifest && hasInstalledPackage && hasPluginFile && configMatchesCanonical;

  return {
    configMatchesCanonical,
    configPath,
    currentPluginEntries,
    expectedPluginEntry,
    hasInstalledPackage,
    hasPluginFile,
    hasWorkspaceManifest,
    healthy,
    installRoot,
  };
}
