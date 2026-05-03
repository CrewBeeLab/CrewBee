import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createCanonicalPluginEntry, runDoctor } from "../../dist/src/install/index.js";

function withFakeOpenCode(callback) {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "crewbee-fake-opencode-"));
  const commandPath = process.platform === "win32"
    ? path.join(binDir, "opencode.cmd")
    : path.join(binDir, "opencode");
  const oldPath = process.env.PATH ?? "";

  if (process.platform === "win32") {
    writeFileSync(commandPath, "@echo opencode 9.9.9\r\n", "utf8");
  } else {
    writeFileSync(commandPath, "#!/usr/bin/env sh\necho opencode 9.9.9\n", "utf8");
    chmodSync(commandPath, 0o755);
  }

  process.env.PATH = `${binDir}${path.delimiter}${oldPath}`;
  let restoreNow = true;

  try {
    const result = callback();

    if (result && typeof result.then === "function") {
      restoreNow = false;
      return result.finally(() => {
        process.env.PATH = oldPath;
      });
    }

    return result;
  } finally {
    if (restoreNow) {
      process.env.PATH = oldPath;
    }
  }
}

function withMissingOpenCode(callback) {
  const oldPath = process.env.PATH ?? "";
  process.env.PATH = mkdtempSync(path.join(os.tmpdir(), "crewbee-no-opencode-"));
  let restoreNow = true;

  try {
    const result = callback();

    if (result && typeof result.then === "function") {
      restoreNow = false;
      return result.finally(() => {
        process.env.PATH = oldPath;
      });
    }

    return result;
  } finally {
    if (restoreNow) {
      process.env.PATH = oldPath;
    }
  }
}

test("runDoctor reports a healthy user-level install when config and files are canonical", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");
  const pluginPath = path.join(installedPackageRoot, "opencode-plugin.mjs");
  const expectedEntry = createCanonicalPluginEntry(installRoot);

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installRoot, "packages", "crewbee@latest", "package.json"), '{"private":true}\n', "utf8");
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(pluginPath, 'const mod = await import("./dist/opencode-plugin.mjs");\n\nconst plugin = mod.default ?? mod;\n\nexport default plugin;\nexport const id = plugin.id;\nexport const server = plugin.server;\n', "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: [expectedEntry] }, null, 2) + "\n", "utf8");

  const result = await withFakeOpenCode(() => runDoctor({
    configPath,
    installRoot,
  }));

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
  writeFileSync(path.join(installRoot, "packages", "crewbee@latest", "package.json"), '{"private":true}\n', "utf8");
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee","version":"0.1.3"}\n', "utf8");
  writeFileSync(pluginPath, 'export default {};\n', "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["crewbee"] }, null, 2) + "\n", "utf8");

  const result = await withFakeOpenCode(() => runDoctor({
    configPath,
    installRoot,
  }));

  assert.equal(result.healthy, true);
  assert.equal(result.hasWorkspaceManifest, true);
  assert.equal(result.hasInstalledPackage, true);
  assert.equal(result.hasPluginFile, true);
  assert.equal(result.installedPackageRoot.replace(/\\/g, "/").endsWith("/packages/crewbee@latest/node_modules/crewbee"), true);
});

test("runDoctor treats missing OpenCode as unhealthy", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-missing-opencode-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-missing-opencode-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");
  const pluginPath = path.join(installedPackageRoot, "opencode-plugin.mjs");

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installRoot, "packages", "crewbee@latest", "package.json"), '{"private":true}\n', "utf8");
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee","version":"0.1.3"}\n', "utf8");
  writeFileSync(pluginPath, 'export default {};\n', "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["crewbee"] }, null, 2) + "\n", "utf8");

  const result = await withMissingOpenCode(() => runDoctor({
    configPath,
    installRoot,
  }));

  assert.equal(result.healthy, false);
  assert.equal(result.opencodeFound, false);
  assert.equal(result.hasWorkspaceManifest, true);
  assert.equal(result.hasInstalledPackage, true);
  assert.equal(result.hasPluginFile, true);
});

test("runDoctor rejects legacy top-level installs as unhealthy residue", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-bun-install-"));
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-bun-config-")), "opencode.json");
  const installedPackageRoot = path.join(installRoot, "node_modules", "crewbee");
  const pluginPath = path.join(installedPackageRoot, "opencode-plugin.mjs");

  mkdirSync(installedPackageRoot, { recursive: true });
  writeFileSync(path.join(installRoot, "package.json"), '{"private":true}\n', "utf8");
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(pluginPath, "export default {};\n", "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: ["crewbee@latest"] }, null, 2) + "\n", "utf8");

  const result = await runDoctor({
    configPath,
    installRoot,
  });

  assert.equal(result.healthy, false);
  assert.equal(result.configMatchesCanonical, true);
  assert.equal(result.hasInstalledPackage, false);
  assert.equal(result.hasPluginFile, false);
  assert.equal(result.hasLegacyInstalledPackage, true);
});

test("runDoctor reports Team definition diagnostics", async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-team-install-"));
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-team-config-"));
  const projectWorktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-doctor-team-project-"));
  const configPath = path.join(configRoot, "opencode.json");
  const installedPackageRoot = path.join(installRoot, "packages", "crewbee@latest", "node_modules", "crewbee");
  const pluginPath = path.join(installedPackageRoot, "opencode-plugin.mjs");
  const expectedEntry = createCanonicalPluginEntry(installRoot);

  mkdirSync(installedPackageRoot, { recursive: true });
  mkdirSync(path.join(projectWorktree, ".crewbee"), { recursive: true });
  writeFileSync(path.join(installRoot, "packages", "crewbee@latest", "package.json"), '{"private":true}\n', "utf8");
  writeFileSync(path.join(installedPackageRoot, "package.json"), '{"name":"crewbee"}\n', "utf8");
  writeFileSync(pluginPath, "export default {};\n", "utf8");
  writeFileSync(configPath, JSON.stringify({ plugin: [expectedEntry] }, null, 2) + "\n", "utf8");
  writeFileSync(path.join(projectWorktree, ".crewbee", "crewbee.json"), "{broken json", "utf8");

  const result = await runDoctor({
    configPath,
    installRoot,
    projectWorktree,
  });

  assert.equal(result.healthy, false);
  assert.equal(result.teamHealthy, false);
  assert.equal(result.blockingTeamIssueCount, 0);
  assert.equal(result.teamCount >= 1, true);
  assert.ok(result.teamIssues.some((issue) => issue.code === "crewbee_config_parse_failed" && issue.sourceScope === "project"));
});
