import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createCanonicalPluginEntry, runDoctor } from "../../dist/src/install/index.js";

test("runDoctor reports a healthy user-level install when config and files are canonical", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "node_modules", "crewbee");
  const pluginPath = path.join(installedPackageRoot, "opencode-plugin.mjs");
  const expectedEntry = createCanonicalPluginEntry(installRoot);

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installRoot, "package.json"), '{"private":true}\n', "utf8");
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(pluginPath, 'const mod = await import("./dist/opencode-plugin.mjs");\n\nconst plugin = mod.default ?? mod;\n\nexport default plugin;\nexport const id = plugin.id;\nexport const server = plugin.server;\n', "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: [expectedEntry] }, null, 2) + "\n", "utf8");

  const result = await runDoctor({
    configPath,
    installRoot,
  });

  assert.equal(result.healthy, true);
  assert.equal(result.configMatchesCanonical, true);
  assert.equal(result.hasInstalledPackage, true);
  assert.equal(result.hasPluginFile, true);
  assert.equal(result.hasWorkspaceManifest, true);
  assert.equal(result.expectedPluginEntry, "crewbee");
});

test("runDoctor accepts the OpenCode package cache layout", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-cache-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-cache-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");
  const pluginPath = path.join(installedPackageRoot, "opencode-plugin.mjs");

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee","version":"0.1.3"}\n', "utf8");
  writeFileSync(pluginPath, 'export default {};\n', "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["crewbee"] }, null, 2) + "\n", "utf8");

  const result = await runDoctor({
    configPath,
    installRoot,
  });

  assert.equal(result.healthy, true);
  assert.equal(result.hasWorkspaceManifest, false);
  assert.equal(result.hasInstalledPackage, true);
  assert.equal(result.hasPluginFile, true);
  assert.equal(result.installedPackageRoot.replace(/\\/g, "/").endsWith("/packages/crewbee@latest/node_modules/crewbee"), true);
});
