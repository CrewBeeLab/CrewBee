import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { backupOpenCodeConfig, removeCrewBeePluginEntries, restoreOpenCodeConfigBackup, upsertCrewBeePluginEntry } from "../../dist/src/install/index.js";

test("upsertCrewBeePluginEntry migrates project-local entries to the canonical user-level entry", () => {
  const config = {
    plugins: [
      "foreign-plugin",
      "file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs",
    ],
  };

  const result = upsertCrewBeePluginEntry(config, "crewbee");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs"]);
  assert.deepEqual(config.plugins, [
    "foreign-plugin",
    "crewbee",
  ]);
});

test("removeCrewBeePluginEntries removes all CrewBee references and preserves foreign plugins", () => {
  const config = {
    plugins: [
      "foreign-plugin",
      "crewbee",
      "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs",
    ],
  };

  const result = removeCrewBeePluginEntries(config);

  assert.equal(result.changed, true);
  assert.deepEqual(result.removedEntries, [
    "crewbee",
    "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs",
  ]);
  assert.deepEqual(config.plugins, ["foreign-plugin"]);
});

test("upsertCrewBeePluginEntry preserves non-string plugin entries", () => {
  const customPlugin = { name: "foreign-object-plugin" };
  const config = {
    plugins: [
      customPlugin,
      "file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs",
    ],
  };

  upsertCrewBeePluginEntry(config, "crewbee");

  assert.deepEqual(config.plugins, [
    customPlugin,
    "crewbee",
  ]);
});

test("upsertCrewBeePluginEntry migrates package-internal js entries to the canonical package entry", () => {
  const config = {
    plugins: [
      "file:///tmp/user/.cache/opencode/crewbee/node_modules/crewbee/opencode-plugin.js",
    ],
  };

  const result = upsertCrewBeePluginEntry(config, "crewbee");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/user/.cache/opencode/crewbee/node_modules/crewbee/opencode-plugin.js"]);
  assert.deepEqual(config.plugins, ["crewbee"]);
});

test("upsertCrewBeePluginEntry migrates legacy standalone shim entries to the canonical package entry", () => {
  const config = {
    plugins: [
      "file:///tmp/user/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs",
    ],
  };

  const result = upsertCrewBeePluginEntry(config, "crewbee");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/user/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs"]);
  assert.deepEqual(config.plugins, ["crewbee"]);
});

test("OpenCode config backup can restore an existing config", () => {
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-config-backup-")), "opencode.json");
  const original = JSON.stringify({ plugins: ["foreign-plugin"] }, null, 2) + "\n";

  writeFileSync(configPath, original, "utf8");
  const backup = backupOpenCodeConfig(configPath);
  writeFileSync(configPath, JSON.stringify({ plugins: ["crewbee"] }, null, 2) + "\n", "utf8");

  restoreOpenCodeConfigBackup(backup);

  assert.equal(typeof backup.backupPath, "string");
  assert.equal(existsSync(backup.backupPath), true);
  assert.equal(readFileSync(configPath, "utf8"), original);
});
