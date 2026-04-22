import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { uninstallCrewBee } from "../../dist/src/install/index.js";

test("uninstallCrewBee removes CrewBee entries while preserving foreign plugins in dry-run mode", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-uninstall-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-uninstall-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "node_modules", "crewbee");

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(configPath, JSON.stringify({
    plugin: [
      "foreign-plugin",
      "file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs",
    ],
  }, null, 2) + "\n", "utf8");

  const result = await uninstallCrewBee({
    configPath,
    dryRun: true,
    installRoot,
  });

  assert.equal(result.configChanged, true);
  assert.equal(result.packageRemoved, true);
  assert.deepEqual(result.removedEntries, ["file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs"]);
  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")).plugin, [
    "foreign-plugin",
    "file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs",
  ]);
});

test("uninstallCrewBee detects cached package-layout installs in dry-run mode", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-uninstall-cache-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-uninstall-cache-config-")), "opencode.json");
  const cachedPackageRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");

  mkdirSync(cachedPackageRoot, { recursive: true });
  writeFileSync(path.join(cachedPackageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(configPath, JSON.stringify({
    plugin: ["crewbee"],
  }, null, 2) + "\n", "utf8");

  const result = await uninstallCrewBee({
    configPath,
    dryRun: true,
    installRoot,
  });

  assert.equal(result.configChanged, true);
  assert.equal(result.packageRemoved, true);
  assert.deepEqual(result.removedEntries, ["crewbee"]);
});
