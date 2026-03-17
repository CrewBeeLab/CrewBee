import type { Writable } from "node:stream";

import { runDoctorCommand } from "./doctor";
import { runInstallCommand } from "./install";
import { renderCliHelp } from "./render-help";
import { runUninstallUserCommand } from "./uninstall-user";

export interface RunCliContext {
  packageRoot: string;
  stderr: Writable;
  stdout: Writable;
}

export async function runCli(argv: string[], context: RunCliContext): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    context.stdout.write(`${renderCliHelp()}\n`);
    return 0;
  }

  if (command === "install" || command === "install:local:user") {
    return runInstallCommand(rest, {
      stderr: context.stderr,
      stdout: context.stdout,
    }, {
      cwd: process.cwd(),
      packageRoot: context.packageRoot,
    });
  }

  if (command === "uninstall:user") {
    return runUninstallUserCommand(rest, {
      stderr: context.stderr,
      stdout: context.stdout,
    });
  }

  if (command === "doctor") {
    return runDoctorCommand(rest, {
      stderr: context.stderr,
      stdout: context.stdout,
    });
  }

  context.stderr.write(`Unknown command '${command}'.\n\n${renderCliHelp()}\n`);
  return 1;
}
