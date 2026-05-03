import { spawnSync } from "node:child_process";

export interface OpenCodeDetectionResult {
  found: boolean;
  path?: string;
  version?: string;
}

export interface OpenCodeInstallResult {
  command: string;
  installed: boolean;
}

function runCommand(command: string, args: string[], stdio: "inherit" | "pipe") {
  return spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio,
  });
}

export function detectOpenCodeCli(): OpenCodeDetectionResult {
  const versionResult = runCommand("opencode", ["--version"], "pipe");

  if (versionResult.error || versionResult.status !== 0) {
    return { found: false };
  }

  const pathResult = process.platform === "win32"
    ? runCommand("where", ["opencode"], "pipe")
    : runCommand("which", ["opencode"], "pipe");
  const pathOutput = typeof pathResult.stdout === "string" ? pathResult.stdout.trim().split(/\r?\n/)[0] : undefined;
  const versionOutput = typeof versionResult.stdout === "string"
    ? versionResult.stdout.trim()
    : undefined;

  return {
    found: true,
    path: pathOutput && pathOutput.length > 0 ? pathOutput : undefined,
    version: versionOutput && versionOutput.length > 0 ? versionOutput : undefined,
  };
}

export function installOpenCodeCli(input: { dryRun: boolean }): OpenCodeInstallResult {
  const command = "npm install -g opencode-ai";

  if (input.dryRun) {
    return {
      command,
      installed: false,
    };
  }

  const result = runCommand("npm", ["install", "-g", "opencode-ai", "--no-audit", "--no-fund"], "inherit");

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error([
      `OpenCode install failed with exit code ${result.status ?? 1}.`,
      "",
      "Try one of these:",
      "- Use nvm / fnm / Volta to fix your global npm prefix.",
      "- Install OpenCode manually from https://opencode.ai/docs/.",
      "- Re-run CrewBee setup after OpenCode is available in PATH.",
    ].join("\n"));
  }

  return {
    command,
    installed: true,
  };
}
