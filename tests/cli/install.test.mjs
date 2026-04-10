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
  assert.match(stdout.getOutput(), /uninstall:user/);
  assert.match(stdout.getOutput(), /doctor/);
  assert.match(stdout.getOutput(), /version/);
  assert.equal(stderr.getOutput(), "");
});

test("runCli version reports current and installed package versions", async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();
  const currentRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-current-"));
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-cli-install-"));
  const installedRoot = path.join(installRoot, "node_modules", "crewbee");

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
