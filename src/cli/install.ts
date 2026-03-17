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
      `Install root: ${result.installRoot}`,
      result.tarballPath ? `Local tarball: ${result.tarballPath}` : undefined,
      `Plugin entry: ${result.pluginEntry}`,
      result.dryRun
        ? (result.workspaceCreated ? "Workspace would be prepared." : "Workspace already present.")
        : (result.workspaceCreated ? "Workspace prepared." : "Workspace already present."),
      result.dryRun
        ? (result.configChanged ? "Plugin array would be updated." : "Plugin array already up to date.")
        : (result.configChanged ? "Plugin array updated." : "Plugin array already up to date."),
      result.migratedEntries.length > 0
        ? `Migrated old entries: ${result.migratedEntries.join(", ")}`
        : undefined,
      "",
      "Next:",
      "1. Start OpenCode in the project where you want CrewBee to run.",
      "2. Select a CrewBee projected agent such as [CodingTeam]leader.",
      "3. Use `crewbee doctor` if you want to verify the user-level install state.",
    ].filter(Boolean).join("\n") + "\n");

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
