import { existsSync } from "node:fs";
import path from "node:path";

export const CREWBEE_PACKAGE_NAME = "crewbee";

export function resolveInstalledPackageRoot(installRoot: string): string {
  return path.join(installRoot, "node_modules", CREWBEE_PACKAGE_NAME);
}

export function resolveInstalledPluginPath(installRoot: string): string {
  return path.join(resolveInstalledPackageRoot(installRoot), "opencode-plugin.mjs");
}

export function createCanonicalPluginEntry(_installRoot?: string): string {
  return CREWBEE_PACKAGE_NAME;
}

export function assertInstalledPluginExists(installRoot: string): void {
  const pluginPath = resolveInstalledPluginPath(installRoot);

  if (!existsSync(pluginPath)) {
    throw new Error(`CrewBee plugin entry does not exist at ${pluginPath}.`);
  }
}
