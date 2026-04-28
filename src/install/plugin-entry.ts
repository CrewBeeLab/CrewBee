import { existsSync } from "node:fs";
import path from "node:path";

export const CREWBEE_PACKAGE_NAME = "crewbee";
export const CREWBEE_PACKAGE_WORKSPACE = "crewbee@latest";

export function resolvePackageWorkspaceRoot(installRoot: string): string {
  return path.join(installRoot, "packages", CREWBEE_PACKAGE_WORKSPACE);
}

export function resolveInstalledPackageRoot(installRoot: string): string {
  return path.join(resolvePackageWorkspaceRoot(installRoot), "node_modules", CREWBEE_PACKAGE_NAME);
}

export function resolveInstalledPluginPath(installRoot: string): string {
  return path.join(resolveInstalledPackageRoot(installRoot), "opencode-plugin.mjs");
}

export function detectInstalledPackageRoot(installRoot: string): string {
  return resolveInstalledPackageRoot(installRoot);
}

export function detectInstalledPluginPath(installRoot: string): string {
  return path.join(detectInstalledPackageRoot(installRoot), "opencode-plugin.mjs");
}

export function createCanonicalPluginEntry(_installRoot?: string): string {
  return CREWBEE_PACKAGE_NAME;
}

export function assertInstalledPluginExists(installRoot: string): void {
  const pluginPath = detectInstalledPluginPath(installRoot);

  if (!existsSync(pluginPath)) {
    throw new Error(`CrewBee plugin entry does not exist at ${pluginPath}.`);
  }
}

export function resolveLegacyInstalledPackageRoot(installRoot: string): string {
  return path.join(installRoot, "node_modules", CREWBEE_PACKAGE_NAME);
}
