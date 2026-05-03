import type { Writable } from "node:stream";

import { runDoctorCommand } from "./doctor";
import { runInstallCommand } from "./install";
import { renderCliHelp } from "./render-help";
import { runSetupCommand } from "./setup";
import { runUninstallUserCommand } from "./uninstall-user";
import { runValidateCommand } from "./validate";
import { runVersionCommand } from "./version";

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

  if (command === "setup") {
    return runSetupCommand(rest, {
      stderr: context.stderr,
      stdout: context.stdout,
    }, {
      cwd: process.cwd(),
      packageRoot: context.packageRoot,
    });
  }

  if (command === "update") {
    return runSetupCommand(["--force", ...rest], {
      stderr: context.stderr,
      stdout: context.stdout,
    }, {
      cwd: process.cwd(),
      packageRoot: context.packageRoot,
    });
  }

  if (command === "install" || command === "install:local:user" || command === "install:registry:user") {
    const installArgv = command === "install:local:user"
      ? ["--source", "local", ...rest]
      : command === "install:registry:user"
        ? ["--source", "registry", ...rest]
        : rest;

    return runInstallCommand(installArgv, {
      stderr: context.stderr,
      stdout: context.stdout,
    }, {
      cwd: process.cwd(),
      packageRoot: context.packageRoot,
    });
  }

  if (command === "uninstall" || command === "uninstall:user") {
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

  if (command === "validate") {
    return runValidateCommand(rest, {
      stderr: context.stderr,
      stdout: context.stdout,
    });
  }

  if (command === "version") {
    return runVersionCommand(rest, {
      stderr: context.stderr,
      stdout: context.stdout,
    }, {
      packageRoot: context.packageRoot,
    });
  }

  context.stderr.write(`Unknown command '${command}'.\n\n${renderCliHelp()}\n`);
  return 1;
}
