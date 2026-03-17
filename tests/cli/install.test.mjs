import test from "node:test";
import assert from "node:assert/strict";

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
  assert.equal(stderr.getOutput(), "");
});
