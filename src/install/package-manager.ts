import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  CREWBEE_PACKAGE_NAME,
  resolveLegacyInstalledPackageRoot,
  resolvePackageWorkspaceRoot,
} from "./plugin-entry";

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

  mkdirSync(input.installRoot, { recursive: true });

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
  const installedPackageRoot = resolveLegacyInstalledPackageRoot(input.installRoot);
  const packageWorkspaceRoot = resolvePackageWorkspaceRoot(input.installRoot);

  if (!existsSync(installedPackageRoot) && !existsSync(packageWorkspaceRoot)) {
    return false;
  }

  if (input.dryRun) {
    return true;
  }

  if (existsSync(packageWorkspaceRoot)) {
    rmSync(packageWorkspaceRoot, { recursive: true, force: true });
  }

  if (existsSync(installedPackageRoot)) {
    const exitCode = runNpmCommand([
      "uninstall",
      "--prefix",
      input.installRoot,
      CREWBEE_PACKAGE_NAME,
      "--no-audit",
      "--no-fund",
    ]);

    if (exitCode !== 0) {
      throw new Error(`npm uninstall failed with exit code ${exitCode}.`);
    }
  }

  return true;
}

export function cleanupLegacyCrewBeePackage(input: {
  dryRun: boolean;
  installRoot: string;
}): boolean {
  const legacyPackageRoot = resolveLegacyInstalledPackageRoot(input.installRoot);

  if (!existsSync(legacyPackageRoot)) {
    return false;
  }

  if (input.dryRun) {
    return true;
  }

  const exitCode = runNpmCommand([
    "uninstall",
    "--prefix",
    input.installRoot,
    CREWBEE_PACKAGE_NAME,
    "--no-audit",
    "--no-fund",
  ]);

  if (exitCode !== 0) {
    throw new Error(`npm uninstall failed with exit code ${exitCode}.`);
  }

  return true;
}
