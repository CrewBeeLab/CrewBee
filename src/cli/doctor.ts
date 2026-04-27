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
      `Project worktree: ${result.projectWorktree}`,
      `Team definitions: ${result.teamHealthy ? "healthy" : "issues found"}`,
      `Loaded Teams: ${result.teamCount}`,
      `Team issues: ${result.teamIssues.length}`,
      `Blocking Team issues: ${result.blockingTeamIssueCount}`,
      ...result.teamIssues.map((issue) => `- ${formatTeamValidationIssue(issue)}`),
    ].join("\n") + "\n");

    return result.healthy ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
