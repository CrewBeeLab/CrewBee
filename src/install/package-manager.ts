import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runNpmCommand(args: string[]): number {
  const result = spawnSync("npm", args, {
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

export function installLocalTarball(input: {
  dryRun: boolean;
  installRoot: string;
  tarballPath: string;
}): void {
  if (input.dryRun) {
    return;
  }

  const exitCode = runNpmCommand([
    "install",
    "--prefix",
    input.installRoot,
    input.tarballPath,
    "--no-audit",
    "--no-fund",
  ]);

  if (exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${exitCode}.`);
  }
}

export function uninstallCrewBeePackage(input: {
  dryRun: boolean;
  installRoot: string;
}): boolean {
  const installedPackageRoot = path.join(input.installRoot, "node_modules", "crewbee");

  if (!existsSync(installedPackageRoot)) {
    return false;
  }

  if (input.dryRun) {
    return true;
  }

  const exitCode = runNpmCommand([
    "uninstall",
    "--prefix",
    input.installRoot,
    "crewbee",
    "--no-audit",
    "--no-fund",
  ]);

  if (exitCode !== 0) {
    throw new Error(`npm uninstall failed with exit code ${exitCode}.`);
  }

  return true;
}
