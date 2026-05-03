import type { Writable } from "node:stream";

import { uninstallCrewBee } from "../install";

import { parseCommandPathOptions } from "./parse-command-path-options";

export async function runUninstallUserCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}): Promise<number> {
  try {
    const options = parseCommandPathOptions(argv, true);
    const result = await uninstallCrewBee(options);

    io.stdout.write([
      result.dryRun ? "CrewBee uninstall plan generated." : "CrewBee uninstall completed.",
      `Config: ${result.configPath}`,
      `Install root: ${result.installRoot}`,
      result.backupPath ? `Backup created: ${result.backupPath}` : undefined,
      result.dryRun
        ? `Config would be updated: ${result.configChanged ? "yes" : "no"}`
        : `Config updated: ${result.configChanged ? "yes" : "no"}`,
      result.dryRun
        ? `Package would be removed: ${result.packageRemoved ? "yes" : "no"}`
        : `Package removed: ${result.packageRemoved ? "yes" : "no"}`,
      result.removedEntries.length > 0
        ? `Removed entries: ${result.removedEntries.join(", ")}`
        : "Removed entries: none",
    ].filter(Boolean).join("\n") + "\n");

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
