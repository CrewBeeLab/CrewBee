import type { Writable } from "node:stream";

import { detectInstalledPackageRoot, resolveInstallRoot } from "../install";
import { readPackageName, readPackageVersion } from "./package-version";

interface VersionOptions {
  installRoot?: string;
  json: boolean;
}

function parseVersionOptions(argv: string[]): VersionOptions {
  let installRoot: string | undefined;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--install-root") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for --install-root.");
      }
      installRoot = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--install-root=")) {
      installRoot = arg.slice("--install-root=".length);
      continue;
    }

    throw new Error(`Unknown option '${arg}'.`);
  }

  return { installRoot, json };
}

export async function runVersionCommand(argv: string[], io: {
  stderr: Writable;
  stdout: Writable;
}, context: { packageRoot: string }): Promise<number> {
  try {
    const options = parseVersionOptions(argv);
    const installedPackageRoot = detectInstalledPackageRoot(resolveInstallRoot(options.installRoot));
    const current = {
      packageName: readPackageName(context.packageRoot),
      version: readPackageVersion(context.packageRoot),
      packageRoot: context.packageRoot,
    };
    const installed = {
      packageName: readPackageName(installedPackageRoot),
      version: readPackageVersion(installedPackageRoot),
      packageRoot: installedPackageRoot,
    };

    if (options.json) {
      io.stdout.write(`${JSON.stringify({ current, installed }, null, 2)}\n`);
      return 0;
    }

    io.stdout.write([
      "CrewBee version",
      "",
      `Current package: ${current.packageName}`,
      `Current version: ${current.version}`,
      `Current package root: ${current.packageRoot}`,
      "",
      `Installed package: ${installed.packageName}`,
      `Installed version: ${installed.version}`,
      `Installed package root: ${installed.packageRoot}`,
    ].filter(Boolean).join("\n") + "\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}
