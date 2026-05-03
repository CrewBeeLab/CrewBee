import type { Writable } from "node:stream";

import { setupCrewBee, type InstallCommandContext } from "../install";

import { parseSetupOptions } from "./parse-setup-options";

export async function runSetupCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}, context: InstallCommandContext): Promise<number> {
  let options;

  try {
    options = parseSetupOptions(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }

  try {
    const result = await setupCrewBee({
      context,
      options,
    });

    io.stdout.write([
      result.dryRun ? "CrewBee setup plan generated." : "CrewBee setup completed.",
      "",
      result.opencodeFound
        ? `✓ OpenCode found${result.opencodePath ? `: ${result.opencodePath}` : ""}${result.opencodeVersion ? ` (${result.opencodeVersion})` : ""}`
        : result.withOpenCode
          ? `• OpenCode would be installed with: ${result.opencodeInstallCommand ?? "npm install -g opencode-ai"}`
          : "• OpenCode not found. Re-run with --with-opencode to install it automatically.",
      result.opencodeInstallAttempted && !result.dryRun
        ? `✓ OpenCode install command: ${result.opencodeInstallCommand}`
        : undefined,
      result.installResult.backupPath
        ? `✓ Backup created: ${result.installResult.backupPath}`
        : undefined,
      `✓ Config: ${result.installResult.configPath}`,
      `✓ Install root: ${result.installResult.installRoot}`,
      `✓ Package workspace: ${result.installResult.packageWorkspaceRoot}`,
      `✓ Plugin entry: ${result.installResult.pluginEntry}`,
      result.installResult.packageSpec
        ? `✓ Registry package: ${result.installResult.packageSpec}`
        : undefined,
      result.installResult.configChanged
        ? (result.dryRun ? "• OpenCode plugin config would be updated." : "✓ OpenCode plugin config updated.")
        : "✓ OpenCode plugin config already up to date.",
      result.installResult.crewbeeConfigChanged
        ? (result.dryRun ? `• crewbee.json would be updated (${result.installResult.crewbeeConfigReason}).` : `✓ crewbee.json updated (${result.installResult.crewbeeConfigReason}).`)
        : "✓ crewbee.json already usable.",
      result.installResult.migratedEntries.length > 0
        ? `✓ Migrated old entries: ${result.installResult.migratedEntries.join(", ")}`
        : undefined,
      result.dryRun
        ? "No files changed."
        : result.doctorRun
          ? `✓ Doctor: ${result.doctorResult?.healthy ? "healthy" : "issues found"}`
          : "• Doctor skipped.",
      "",
      "Next:",
      "  cd /path/to/your/project",
      "  opencode",
      "  select coding-leader",
    ].filter(Boolean).join("\n") + "\n");

    return result.doctorResult && !result.doctorResult.healthy ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
