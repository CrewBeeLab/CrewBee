import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { installCrewBee } from "../../dist/src/install/index.js";

test("installCrewBee plans a user-level install without mutating files in dry-run mode", async () => {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-repo-"));
  const installRoot = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-install-")), "workspace");
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-config-")), "opencode.json");
  const localArtifactsRoot = path.join(repoRoot, ".artifacts", "local");
  const tarballPath = path.join(localArtifactsRoot, "crewbee-local.tgz");

  mkdirSync(localArtifactsRoot, { recursive: true });
  writeFileSync(path.join(repoRoot, "placeholder.txt"), "repo\n", "utf8");
  writeFileSync(tarballPath, "fake tarball\n", { encoding: "utf8", flag: "w" });

  const result = await installCrewBee({
    context: {
      cwd: repoRoot,
      packageRoot: repoRoot,
    },
    options: {
      configPath,
      dryRun: true,
      installRoot,
      source: "local",
    },
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.workspaceCreated, true);
  assert.equal(result.tarballPath, tarballPath);
  assert.match(result.pluginEntry, /\/node_modules\/crewbee\/opencode-plugin\.mjs$/);
  assert.equal(existsSync(configPath), false);
});
