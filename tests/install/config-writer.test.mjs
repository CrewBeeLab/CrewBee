import test from "node:test";
import assert from "node:assert/strict";

import { removeCrewBeePluginEntries, upsertCrewBeePluginEntry } from "../../dist/src/install/index.js";

test("upsertCrewBeePluginEntry migrates project-local entries to the canonical user-level entry", () => {
  const config = {
    plugin: [
      "foreign-plugin",
      "file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs",
    ],
  };

  const result = upsertCrewBeePluginEntry(config, "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs"]);
  assert.deepEqual(config.plugin, [
    "foreign-plugin",
    "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs",
  ]);
});

test("removeCrewBeePluginEntries removes all CrewBee references and preserves foreign plugins", () => {
  const config = {
    plugin: [
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
  assert.deepEqual(config.plugin, ["foreign-plugin"]);
});

test("upsertCrewBeePluginEntry preserves non-string plugin entries", () => {
  const customPlugin = { name: "foreign-object-plugin" };
  const config = {
    plugin: [
      customPlugin,
      "file:///tmp/project/node_modules/crewbee/opencode-plugin.mjs",
    ],
  };

  upsertCrewBeePluginEntry(config, "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs");

  assert.deepEqual(config.plugin, [
    customPlugin,
    "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs",
  ]);
});

test("upsertCrewBeePluginEntry migrates package-internal js entries to the canonical package entry", () => {
  const config = {
    plugin: [
      "file:///tmp/user/.cache/opencode/crewbee/node_modules/crewbee/opencode-plugin.js",
    ],
  };

  const result = upsertCrewBeePluginEntry(config, "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/user/.cache/opencode/crewbee/node_modules/crewbee/opencode-plugin.js"]);
  assert.deepEqual(config.plugin, ["file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs"]);
});

test("upsertCrewBeePluginEntry migrates legacy standalone shim entries to the canonical package entry", () => {
  const config = {
    plugin: [
      "file:///tmp/user/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs",
    ],
  };

  const result = upsertCrewBeePluginEntry(config, "file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs");

  assert.equal(result.changed, true);
  assert.deepEqual(result.migratedEntries, ["file:///tmp/user/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs"]);
  assert.deepEqual(config.plugin, ["file:///tmp/user/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs"]);
});
