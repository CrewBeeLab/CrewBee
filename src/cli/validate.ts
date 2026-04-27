import type { Writable } from "node:stream";
import path from "node:path";

import {
  formatTeamValidationIssue,
  loadDefaultTeamLibrary,
  summarizeTeamDiagnostics,
  validateTeamLibrary,
} from "../agent-teams";
import { resolveOpenCodeConfigRoot } from "../install";

interface ValidateCommandOptions {
  configPath?: string;
  json: boolean;
  projectWorktree?: string;
}

function getOptionValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}

function parseValidateOptions(argv: string[]): ValidateCommandOptions {
  let configPath: string | undefined;
  let json = false;
  let projectWorktree: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--config-path" || arg === "--config") {
      configPath = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--config-path=")) {
      configPath = arg.slice("--config-path=".length);
      continue;
    }

    if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--project-worktree") {
      projectWorktree = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--project-worktree=")) {
      projectWorktree = arg.slice("--project-worktree=".length);
      continue;
    }

    throw new Error(`Unknown option '${arg}'.`);
  }

  return { configPath, json, projectWorktree };
}

export async function runValidateCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}): Promise<number> {
  try {
    const options = parseValidateOptions(argv);
    const projectWorktree = path.resolve(options.projectWorktree ?? process.cwd());
    const globalConfigRoot = resolveOpenCodeConfigRoot(options.configPath);
    const library = loadDefaultTeamLibrary({ globalConfigRoot, projectWorktree });
    const issues = validateTeamLibrary(library);
    const diagnostics = summarizeTeamDiagnostics(issues);

    if (options.json) {
      io.stdout.write(`${JSON.stringify({
        healthy: diagnostics.healthy,
        issueCount: diagnostics.issueCount,
        blockingIssueCount: diagnostics.blockingIssueCount,
        globalConfigRoot,
        projectWorktree,
        teamCount: library.teams.length,
        issues,
      }, null, 2)}\n`);
      return diagnostics.healthy ? 0 : 1;
    }

    io.stdout.write([
      diagnostics.healthy ? "CrewBee Team validation: healthy." : "CrewBee Team validation: issues found.",
      `Global config root: ${globalConfigRoot}`,
      `Project worktree: ${projectWorktree}`,
      `Loaded Teams: ${library.teams.length}`,
      `Team issues: ${issues.length}`,
      `Blocking Team issues: ${diagnostics.blockingIssueCount}`,
      ...issues.map((issue) => `- ${formatTeamValidationIssue(issue)}`),
    ].join("\n") + "\n");

    return diagnostics.healthy ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
