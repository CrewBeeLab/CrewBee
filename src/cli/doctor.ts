import type { Writable } from "node:stream";

import { runDoctor } from "../install";
import { readPackageVersion } from "../version/package-version";

import { parseCommandPathOptions } from "./parse-command-path-options";

export async function runDoctorCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}): Promise<number> {
  try {
    const options = parseCommandPathOptions(argv, false);
    const result = await runDoctor({
      configPath: options.configPath,
      installRoot: options.installRoot,
    });
    const installedVersion = readPackageVersion(result.installedPackageRoot);

    io.stdout.write([
      result.healthy ? "CrewBee doctor: healthy." : "CrewBee doctor: issues found.",
      `Installed version: ${installedVersion}`,
      `Config: ${result.configPath}`,
      `Install root: ${result.installRoot}`,
      `Workspace manifest: ${result.hasWorkspaceManifest ? "yes" : "no"}`,
      `Installed package: ${result.hasInstalledPackage ? "yes" : "no"}`,
      `Plugin file: ${result.hasPluginFile ? "yes" : "no"}`,
      `Canonical config entry: ${result.configMatchesCanonical ? "yes" : "no"}`,
      result.currentPluginEntries.length > 0
        ? `Current CrewBee entries: ${result.currentPluginEntries.join(", ")}`
        : "Current CrewBee entries: none",
      `Expected entry: ${result.expectedPluginEntry}`,
    ].join("\n") + "\n");

    return result.healthy ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
