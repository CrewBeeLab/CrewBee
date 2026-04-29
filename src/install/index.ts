export { readOpenCodeConfig, removeCrewBeePluginEntries, upsertCrewBeePluginEntry, writeOpenCodeConfig } from "./opencode-config-file";
export { runDoctor } from "./doctor";
export { installCrewBee } from "./install";
export { resolveOpenCodeConfigPath, resolveOpenCodeConfigRoot, resolveInstallRoot } from "./install-root";
export { resolveLocalTarballPath } from "./local-tarball";
export { cleanupLegacyCrewBeePackage, installLocalTarball, installRegistryPackage, uninstallCrewBeePackage } from "./package-installation";
export {
  assertInstalledPluginExists,
  createCanonicalPluginEntry,
  detectInstalledPackageRoot,
  detectInstalledPluginPath,
  resolveLegacyInstalledPackageRoot,
  resolveInstalledPackageRoot,
  resolveInstalledPluginPath,
  resolvePackageWorkspaceRoot,
} from "./plugin-entry";
export type { DoctorOptions, DoctorResult, InstallCommandContext, InstallCommandOptions, InstallResult, InstallSource, UninstallOptions, UninstallResult } from "./types";
export { uninstallCrewBee } from "./uninstall";
export { ensureInstallWorkspace } from "./workspace";
