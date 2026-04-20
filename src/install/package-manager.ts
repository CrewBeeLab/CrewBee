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

function installPackageSpec(input: {
  dryRun: boolean;
  installRoot: string;
  packageSpec: string;
}): void {
  if (input.dryRun) {
    return;
  }

  const exitCode = runNpmCommand([
    "install",
    "--prefix",
    input.installRoot,
    input.packageSpec,
    "--no-audit",
    "--no-fund",
  ]);

  if (exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${exitCode}.`);
  }
}

export function installLocalTarball(input: {
  dryRun: boolean;
  installRoot: string;
  tarballPath: string;
}): void {
  installPackageSpec({
    dryRun: input.dryRun,
    installRoot: input.installRoot,
    packageSpec: input.tarballPath,
  });
}

export function installRegistryPackage(input: {
  dryRun: boolean;
  installRoot: string;
  packageSpec: string;
}): void {
  installPackageSpec(input);
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
