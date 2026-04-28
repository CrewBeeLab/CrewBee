import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseInstallOptions } from "../../dist/src/cli/parse-install-options.js";
import { runCli } from "../../dist/src/cli/run-cli.js";

function createCaptureStream() {
  let output = "";

  return {
    getOutput() {
      return output;
    },
    write(chunk) {
      output += String(chunk);
      return true;
    },
  };
}

test("parseInstallOptions supports canonical flags and deprecated aliases", () => {
  const canonical = parseInstallOptions([
    "--source", "local",
    "--local-tarball", "./artifact.tgz",
    "--install-root", "./install-root",
    "--config-path", "./opencode.json",
    "--dry-run",
  ]);

  const legacy = parseInstallOptions([
    "--source=local",
    "--tarball=./artifact.tgz",
    "--config=./opencode.json",
  ]);

  assert.equal(canonical.source, "local");
  assert.equal(canonical.localTarballPath, "./artifact.tgz");
  assert.equal(canonical.installRoot, "./install-root");
  assert.equal(canonical.configPath, "./opencode.json");
  assert.equal(canonical.dryRun, true);
  assert.equal(legacy.localTarballPath, "./artifact.tgz");
  assert.equal(legacy.configPath, "./opencode.json");
});

test("runCli help output includes user-level commands", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();

  const exitCode = await runCli(["help"], {
    packageRoot: process.cwd(),
    stderr,
    stdout,
  });

  assert.equal(exitCode, 0);
  assert.match(stdout.getOutput(), /install:local:user/);
  assert.match(stdout.getOutput(), /install:registry:user/);
  assert.match(stdout.getOutput(), /uninstall:user/);
  assert.match(stdout.getOutput(), /doctor/);
  assert.match(stdout.getOutput(), /validate/);
  assert.match(stdout.getOutput(), /version/);
  assert.equal(stderr.getOutput(), "");
});

test("runCli validate reports project Team config diagnostics", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-validate-config-"));
  const projectWorktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-validate-project-"));

  mkdirSync(path.join(projectWorktree, ".crewbee"), { recursive: true });
  writeFileSync(path.join(projectWorktree, ".crewbee", "crewbee.json"), "{broken json", "utf8");

  const exitCode = await runCli([
    "validate",
    "--config-path",
    path.join(configRoot, "opencode.json"),
    "--project-worktree",
    projectWorktree,
  ], {
    packageRoot: process.cwd(),
    stderr,
    stdout,
  });

  assert.equal(exitCode, 1);
  assert.match(stdout.getOutput(), /CrewBee Team validation: issues found/);
  assert.match(stdout.getOutput(), /crewbee_config_parse_failed/);
  assert.match(stdout.getOutput(), /scope=project/);
  assert.match(stdout.getOutput(), /Blocking Team issues: 0/);
  assert.equal(stderr.getOutput(), "");
});

test("runCli validate supports machine-readable JSON diagnostics", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-validate-json-config-"));
  const projectWorktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-validate-json-project-"));

  mkdirSync(path.join(projectWorktree, ".crewbee"), { recursive: true });
  writeFileSync(path.join(projectWorktree, ".crewbee", "crewbee.json"), "{broken json", "utf8");

  const exitCode = await runCli([
    "validate",
    "--json",
    "--config-path",
    path.join(configRoot, "opencode.json"),
    "--project-worktree",
    projectWorktree,
  ], {
    packageRoot: process.cwd(),
    stderr,
    stdout,
  });
  const parsed = JSON.parse(stdout.getOutput());

  assert.equal(exitCode, 1);
  assert.equal(parsed.healthy, false);
  assert.equal(parsed.blockingIssueCount, 0);
  assert.equal(parsed.issues.some((issue) => issue.code === "crewbee_config_parse_failed" && issue.sourceScope === "project"), true);
  assert.equal(stderr.getOutput(), "");
});

test("runCli validate succeeds for default embedded Team diagnostics", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-validate-healthy-config-"));
  const projectWorktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-validate-healthy-project-"));

  const exitCode = await runCli([
    "validate",
    "--json",
    "--config-path",
    path.join(configRoot, "opencode.json"),
    "--project-worktree",
    projectWorktree,
  ], {
    packageRoot: process.cwd(),
    stderr,
    stdout,
  });
  const parsed = JSON.parse(stdout.getOutput());

  assert.equal(exitCode, 0);
  assert.equal(parsed.healthy, true);
  assert.equal(parsed.issueCount, 0);
  assert.equal(parsed.teamCount >= 1, true);
  assert.equal(stderr.getOutput(), "");
});

test("runCli doctor reports Team diagnostics for the selected project worktree", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-doctor-install-"));
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-doctor-config-"));
  const projectWorktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-doctor-project-"));
  const installedRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");
  const configPath = path.join(configRoot, "opencode.json");

  mkdirSync(installedRoot, { recursive: true });
  mkdirSync(path.join(projectWorktree, ".crewbee"), { recursive: true });
  writeFileSync(path.join(installRoot, "packages", "crewbee@latest", "package.json"), JSON.stringify({ private: true }, null, 2), "utf8");
  writeFileSync(path.join(installedRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "9.9.9" }, null, 2), "utf8");
  writeFileSync(path.join(installedRoot, "opencode-plugin.mjs"), "export default {};\n", "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["crewbee"] }, null, 2), "utf8");
  writeFileSync(path.join(projectWorktree, ".crewbee", "crewbee.json"), "{broken json", "utf8");

  const exitCode = await runCli([
    "doctor",
    "--install-root",
    installRoot,
    "--config-path",
    configPath,
    "--project-worktree",
    projectWorktree,
  ], {
    packageRoot: process.cwd(),
    stderr,
    stdout,
  });

  assert.equal(exitCode, 1);
  assert.match(stdout.getOutput(), /CrewBee doctor: issues found/);
  assert.match(stdout.getOutput(), /Installed version: 9\.9\.9/);
  assert.match(stdout.getOutput(), /Team definitions: issues found/);
  assert.match(stdout.getOutput(), /crewbee_config_parse_failed/);
  assert.match(stdout.getOutput(), /Blocking Team issues: 0/);
  assert.equal(stderr.getOutput(), "");
});

test("runCli doctor reports legacy top-level package residue as unhealthy", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-doctor-legacy-install-"));
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-doctor-legacy-config-"));
  const installedRoot = path.join(installRoot, "node_modules", "crewbee");
  const configPath = path.join(configRoot, "opencode.json");

  mkdirSync(installedRoot, { recursive: true });
  writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({ private: true }, null, 2), "utf8");
  writeFileSync(path.join(installedRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "8.8.8" }, null, 2), "utf8");
  writeFileSync(path.join(installedRoot, "opencode-plugin.mjs"), "export default {};\n", "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["crewbee"] }, null, 2), "utf8");

  const exitCode = await runCli([
    "doctor",
    "--install-root",
    installRoot,
    "--config-path",
    configPath,
  ], {
    packageRoot: process.cwd(),
    stderr,
    stdout,
  });

  assert.equal(exitCode, 1);
  assert.match(stdout.getOutput(), /CrewBee doctor: issues found/);
  assert.match(stdout.getOutput(), /Installed package: no/);
  assert.match(stdout.getOutput(), /Plugin file: no/);
  assert.match(stdout.getOutput(), /Legacy top-level package: yes/);
  assert.equal(stderr.getOutput(), "");
});

test("runCli version reports current and installed package versions", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const currentRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-current-"));
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-install-"));
  const installedRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");

  writeFileSync(path.join(currentRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "1.2.3" }, null, 2), "utf8");
  mkdirSync(installedRoot, { recursive: true });
  writeFileSync(path.join(installedRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "9.8.7" }, null, 2), "utf8");

  const exitCode = await runCli(["version", "--install-root", installRoot], {
    packageRoot: currentRoot,
    stderr,
    stdout,
  });

  assert.equal(exitCode, 0);
  assert.match(stdout.getOutput(), /Current version: 1\.2\.3/);
  assert.match(stdout.getOutput(), /Installed version: 9\.8\.7/);
  assert.equal(stderr.getOutput(), "");
});

test("runCli version detects installed package in the OpenCode package cache", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const currentRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-current-cache-"));
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-install-cache-"));
  const installedRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");

  writeFileSync(path.join(currentRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "1.2.3" }, null, 2), "utf8");
  mkdirSync(installedRoot, { recursive: true });
  writeFileSync(path.join(installedRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "0.1.3" }, null, 2), "utf8");

  const exitCode = await runCli(["version", "--install-root", installRoot], {
    packageRoot: currentRoot,
    stderr,
    stdout,
  });

  assert.equal(exitCode, 0);
  assert.match(stdout.getOutput(), /Installed version: 0\.1\.3/);
  assert.equal(stderr.getOutput(), "");
});
