import type { Writable } from "node:stream";

import { installCrewBee, type InstallCommandContext } from "../install";

import { parseInstallOptions } from "./parse-install-options";

export async function runInstallCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}, context: InstallCommandContext): Promise<number> {
  let options;

  try {
    options = parseInstallOptions(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }

  try {
    const result = await installCrewBee({
      context,
      options,
    });

    io.stdout.write([
      result.dryRun ? "CrewBee user-level install plan generated." : "CrewBee user-level install completed.",
      `Config: ${result.configPath}`,
      `CrewBee Team config: ${result.crewbeeConfigPath}`,
      `Install root: ${result.installRoot}`,
      `Package workspace: ${result.packageWorkspaceRoot}`,
      result.backupPath ? `Backup created: ${result.backupPath}` : undefined,
      result.tarballPath ? `Local tarball: ${result.tarballPath}` : undefined,
      result.packageSpec ? `Registry package: ${result.packageSpec}` : undefined,
      `Plugin entry: ${result.pluginEntry}`,
      result.dryRun
        ? (result.workspaceCreated ? "Workspace would be prepared." : "Workspace already present.")
        : (result.workspaceCreated ? "Workspace prepared." : "Workspace already present."),
      result.dryRun
        ? (result.configChanged ? "Plugin array would be updated." : "Plugin array already up to date.")
        : (result.configChanged ? "Plugin array updated." : "Plugin array already up to date."),
      result.dryRun
        ? (result.crewbeeConfigChanged ? `crewbee.json would be updated (${result.crewbeeConfigReason}).` : "crewbee.json already usable.")
        : (result.crewbeeConfigChanged ? `crewbee.json updated (${result.crewbeeConfigReason}).` : "crewbee.json already usable."),
      result.migratedEntries.length > 0
        ? `Migrated old entries: ${result.migratedEntries.join(", ")}`
        : undefined,
      result.legacyPackageRemoved ? "Removed legacy top-level package: yes" : undefined,
      "",
      "Next:",
      "  cd /path/to/your/project",
      "  opencode",
      "  select coding-leader",
      "",
      "CrewBee installs into the OpenCode user-level workspace and does not modify your repository files.",
    ].filter(Boolean).join("\n") + "\n");

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
