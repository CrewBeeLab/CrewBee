import type { Writable } from "node:stream";

import { formatTeamValidationIssue } from "../agent-teams";
import { runDoctor } from "../install";
import { readPackageVersion } from "../version/package-version";

import { parseCommandPathOptions } from "./parse-command-path-options";

interface DoctorCommandOptions {
  configPath?: string;
  installRoot?: string;
  projectWorktree?: string;
}

function parseDoctorOptions(argv: string[]): DoctorCommandOptions {
  const pathOptionsArgv: string[] = [];
  let projectWorktree: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project-worktree") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for --project-worktree.");
      }

      projectWorktree = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--project-worktree=")) {
      projectWorktree = arg.slice("--project-worktree=".length);
      continue;
    }

    pathOptionsArgv.push(arg);
  }

  const pathOptions = parseCommandPathOptions(pathOptionsArgv, false);
  return {
    configPath: pathOptions.configPath,
    installRoot: pathOptions.installRoot,
    projectWorktree,
  };
}

export async function runDoctorCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}): Promise<number> {
  try {
    const options = parseDoctorOptions(argv);
    const result = await runDoctor({
      configPath: options.configPath,
      installRoot: options.installRoot,
      projectWorktree: options.projectWorktree,
    });
    const installedVersion = readPackageVersion(result.installedPackageRoot);
    const status = result.healthy ? "healthy" : "issues found";

    io.stdout.write([
      "CrewBee Doctor",
      "",
      `Status: ${status}`,
      result.healthy ? "CrewBee doctor: healthy." : "CrewBee doctor: issues found.",
      `${result.opencodeFound ? "✓" : "•"} OpenCode: ${result.opencodeFound ? (result.opencodePath ?? "found") : "not found in PATH"}${result.opencodeVersion ? ` (${result.opencodeVersion})` : ""}`,
      `✓ Config root file: ${result.configPath}`,
      `✓ Install root: ${result.installRoot}`,
      `${result.hasWorkspaceManifest ? "✓" : "✕"} Workspace manifest: ${result.hasWorkspaceManifest ? "yes" : "no"}`,
      `${result.hasInstalledPackage ? "✓" : "✕"} Installed package: ${result.hasInstalledPackage ? "yes" : "no"}`,
      `Installed version: ${installedVersion}`,
      `${result.hasPluginFile ? "✓" : "✕"} Plugin file: ${result.hasPluginFile ? "yes" : "no"}`,
      `${result.hasLegacyInstalledPackage ? "✕" : "✓"} Legacy top-level package: ${result.hasLegacyInstalledPackage ? "yes" : "no"}`,
      `${result.configMatchesCanonical ? "✓" : "✕"} Canonical config entry: ${result.configMatchesCanonical ? "yes" : "no"}`,
      result.currentPluginEntries.length > 0
        ? `Current CrewBee entries: ${result.currentPluginEntries.join(", ")}`
        : "Current CrewBee entries: none",
      `Expected entry: ${result.expectedPluginEntry}`,
      `Project worktree: ${result.projectWorktree}`,
      `${result.teamHealthy ? "✓" : "✕"} Team definitions: ${result.teamHealthy ? "healthy" : "issues found"}`,
      `Loaded Teams: ${result.teamCount}`,
      `Team issues: ${result.teamIssues.length}`,
      `Blocking Team issues: ${result.blockingTeamIssueCount}`,
      ...result.teamIssues.map((issue) => `- ${formatTeamValidationIssue(issue)}`),
      "",
      "Model Resolution:",
      ...result.modelResolution.map((entry) => [
        `- ${entry.teamId}/${entry.agentId}: ${entry.resolvedModel}`,
        `  configured: ${entry.configuredModel ?? "none"}`,
        `  source: ${entry.source}`,
        `  fallback: ${entry.fallback}`,
        `  fallback_to_host_default: ${entry.fallbackToHostDefault}`,
        entry.skipped.length > 0
          ? `  skipped: ${entry.skipped.map((skipped) => `${skipped.model} (${skipped.reason})`).join(", ")}`
          : undefined,
        entry.reason ? `  reason: ${entry.reason}` : undefined,
      ].filter(Boolean).join("\n")),
      "",
      "Next:",
      "  cd /path/to/project",
      "  opencode",
      "  select coding-leader",
    ].join("\n") + "\n");

    return result.healthy ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
