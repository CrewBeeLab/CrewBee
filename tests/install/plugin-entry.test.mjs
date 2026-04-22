import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertInstalledPluginExists,
  createCanonicalPluginEntry,
  resolveInstalledPluginPath,
} from "../../dist/src/install/index.js";

test("createCanonicalPluginEntry points at the package-local OpenCode entry", () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-plugin-entry-"));
  const pluginPath = resolveInstalledPluginPath(installRoot);

  mkdirSync(path.dirname(pluginPath), { recursive: true });
  writeFileSync(pluginPath, 'const mod = await import("./dist/opencode-plugin.mjs");\n\nconst plugin = mod.default ?? mod;\n\nexport default plugin;\n', "utf8");
  const content = readFileSync(pluginPath, "utf8");

  assert.equal(createCanonicalPluginEntry(installRoot), "crewbee");
  assert.match(content, /await import/);
  assert.match(content, /\.\/dist\/opencode-plugin\.mjs/);
  assert.equal(resolveInstalledPluginPath(installRoot).replace(/\\/g, "/").endsWith("/node_modules/crewbee/opencode-plugin.mjs"), true);
});

test("assertInstalledPluginExists accepts the OpenCode package cache layout", () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-plugin-cache-entry-"));
  const packageRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");
  const pluginPath = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee", "opencode-plugin.mjs");

  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(path.join(packageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(pluginPath, 'export default {};\n', "utf8");

  assert.doesNotThrow(() => assertInstalledPluginExists(installRoot));
});
