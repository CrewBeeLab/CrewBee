import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function resolveInstalledPackageRoot(installRoot: string): string {
  return path.join(installRoot, "node_modules", "crewbee");
}

export function resolveInstalledPluginPath(installRoot: string): string {
  return path.join(resolveInstalledPackageRoot(installRoot), "opencode-plugin.mjs");
}

export function createCanonicalPluginEntry(installRoot: string): string {
  return pathToFileURL(resolveInstalledPluginPath(installRoot)).href;
}

export function assertInstalledPluginExists(installRoot: string): void {
  const pluginPath = resolveInstalledPluginPath(installRoot);

  if (!existsSync(pluginPath)) {
    throw new Error(`CrewBee plugin entry does not exist at ${pluginPath}.`);
  }
}
