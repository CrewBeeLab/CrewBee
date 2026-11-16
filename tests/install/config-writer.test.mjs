import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { backupOpenCodeConfig, removeCrewBeePluginEntries, restoreOpenCodeConfigBackup, upsertCrewBeePluginEntry } from "../../dist/src/install/index.js";
import { resolveOpenCodePluginFormat, writeOpenCodeConfig } from "../../dist/src/install/opencode-config-file.js";
import { findConfiguredCrewBeeReleaseIntent } from "../../dist/src/update/intent.js";

test("V2 key-only migration is persisted and remains discoverable for updates", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "crewbee-v2-migration-"));
  const file = path.join(root, "opencode.json");
  const config = { plugin: ["foreign-plugin", "crewbee"] };
  const result = upsertCrewBeePluginEntry(config, "crewbee", "v2");
  assert.equal(result.changed, true);
  if (result.changed) writeOpenCodeConfig(file, config);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { plugins: ["foreign-plugin", "crewbee"] });
  assert.equal(upsertCrewBeePluginEntry(config, "crewbee", "v2").changed, false);
  const previous = process.env.OPENCODE_CONFIG_DIR;
  process.env.OPENCODE_CONFIG_DIR = root;
  try {
    assert.equal(findConfiguredCrewBeeReleaseIntent()?.entry, "crewbee");
    writeOpenCodeConfig(file, { plugins: [{ package: "crewbee@0.1.24", options: { enabled: true } }] });
    assert.equal(findConfiguredCrewBeeReleaseIntent()?.isPinned, true);
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_CONFIG_DIR;
    else process.env.OPENCODE_CONFIG_DIR = previous;
  }
});

test("host-specific config formats retain plugin options and uninstall preserves foreign entries", () => {
  const config = { plugin: [["foreign", { enabled: false }], ["crewbee", { custom: true }]] };
  assert.equal(resolveOpenCodePluginFormat(config, "1.18.29"), "v1");
  assert.equal(resolveOpenCodePluginFormat(config, "2.2.0"), "v2");
  assert.equal(resolveOpenCodePluginFormat(config, "opencode v2.2.0"), "v2");
  assert.equal(upsertCrewBeePluginEntry(config, "crewbee", "v1").changed, false);
  assert.equal(upsertCrewBeePluginEntry(config, "crewbee", "v2").changed, true);
  assert.deepEqual(config.plugins, [{ package: "foreign", options: { enabled: false } }, { package: "crewbee", options: { custom: true } }]);
  assert.equal(upsertCrewBeePluginEntry(config, "crewbee", "v2").changed, false);
  upsertCrewBeePluginEntry(config, "crewbee", "v1");
  removeCrewBeePluginEntries(config);
  assert.deepEqual(config, { plugin: [["foreign", { enabled: false }]] });
});

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
