import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import agentTeams from "../../dist/src/agent-teams/index.js";
import { installCrewBee } from "../../dist/src/install/index.js";

const { ensureCrewBeeConfigFile, resolveCrewBeeConfigPath } = agentTeams;

function readExpectedCrewBeeConfigTemplate() {
  return JSON.parse(readFileSync(path.join(process.cwd(), "templates", "crewbee.json"), "utf8"));
}

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
  assert.equal(result.pluginEntry, "crewbee");
  assert.equal(result.crewbeeConfigPath, path.join(path.dirname(configPath), "crewbee.json"));
  assert.equal(result.crewbeeConfigChanged, true);
  assert.equal(result.crewbeeConfigReason, "created-default");
  assert.equal(existsSync(configPath), false);
  assert.equal(existsSync(result.crewbeeConfigPath), false);
  assert.equal(existsSync(path.join(path.dirname(configPath), "teams")), false);
});

test("installCrewBee supports registry source in dry-run mode", async () => {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-repo-registry-"));
  const installRoot = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-install-registry-")), "workspace");
  const configPath = path.join(mkdtempSync(path.join(os.tmpdir(), "crewbee-config-registry-")), "opencode.json");

  writeFileSync(path.join(repoRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "0.9.1" }, null, 2), "utf8");

  const result = await installCrewBee({
    context: {
      cwd: repoRoot,
      packageRoot: repoRoot,
    },
    options: {
      configPath,
      dryRun: true,
      installRoot,
      source: "registry",
    },
  });

  assert.equal(result.pluginEntry, "crewbee");
  assert.equal(result.packageSpec, "crewbee@latest");
  assert.equal(result.tarballPath, undefined);
  assert.equal(existsSync(configPath), false);
});

test("ensureCrewBeeConfigFile adds default coding-team during install mode", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-team-config-"));
  const configPath = resolveCrewBeeConfigPath(configRoot);

  writeFileSync(configPath, JSON.stringify({
    teams: [
      { path: "@tmp/custom-team", enabled: true, priority: 3 },
    ],
  }, null, 2) + "\n", "utf8");

  const result = ensureCrewBeeConfigFile({
    configRoot,
    mode: "install",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "added-default-coding-team");
  assert.deepEqual(written.teams[0], {
    id: "coding-team",
    enabled: true,
    priority: 0,
  });
  assert.deepEqual(written.teams[1], {
    path: "@tmp/custom-team",
    enabled: true,
    priority: 3,
  });
  assert.equal(existsSync(path.join(configRoot, "teams")), false);
});

test("ensureCrewBeeConfigFile creates crewbee.json from the packaged template", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-team-config-template-"));
  const configPath = resolveCrewBeeConfigPath(configRoot);

  const result = ensureCrewBeeConfigFile({
    configRoot,
    mode: "install",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "created-default");
  assert.deepEqual(written, readExpectedCrewBeeConfigTemplate());
  assert.equal(existsSync(path.join(configRoot, "teams", "general-team", "team.manifest.yaml")), true);
  assert.equal(existsSync(path.join(configRoot, "teams", "template-team", "team.manifest.yaml")), true);
  assert.equal(existsSync(path.join(configRoot, "teams", "wukong-team", "team.manifest.yaml")), true);
});

test("package manifest includes the crewbee.json template asset", () => {
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

  assert.ok(manifest.files.includes("templates"));
  assert.ok(existsSync(path.join(process.cwd(), "templates", "crewbee.json")));
});

test("npm pack dry-run includes packaged config and team templates", () => {
  const result = process.platform === "win32"
    ? spawnSync("npm pack --dry-run --json --ignore-scripts", {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
    })
    : spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

  assert.equal(result.status, 0, result.stderr || result.error?.message);

  const [packInfo] = JSON.parse(result.stdout);
  const files = packInfo.files.map((entry) => entry.path);

  assert.ok(files.includes("templates/crewbee.json"));
  assert.ok(files.includes("templates/teams/general-team/team.manifest.yaml"));
  assert.ok(files.includes("templates/teams/template-team/team.manifest.yaml"));
  assert.ok(files.includes("templates/teams/wukong-team/team.manifest.yaml"));
});

test("ensureCrewBeeConfigFile preserves existing non-object team entries while adding coding-team", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-team-config-preserve-"));
  const configPath = resolveCrewBeeConfigPath(configRoot);

  writeFileSync(configPath, JSON.stringify({
    teams: [
      "legacy-entry",
      { path: "@tmp/custom-team", enabled: true },
    ],
  }, null, 2) + "\n", "utf8");

  const result = ensureCrewBeeConfigFile({
    configRoot,
    mode: "install",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "added-default-coding-team");
  assert.deepEqual(written.teams, [
    {
      id: "coding-team",
      enabled: true,
      priority: 0,
    },
    "legacy-entry",
    {
      path: "@tmp/custom-team",
      enabled: true,
    },
  ]);
  assert.equal(existsSync(path.join(configRoot, "teams")), false);
});

test("ensureCrewBeeConfigFile repairs invalid config during startup mode", () => {
  const configRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-team-config-invalid-"));
  const configPath = resolveCrewBeeConfigPath(configRoot);
  const invalidContent = "{invalid json";

  writeFileSync(configPath, invalidContent, "utf8");

  const result = ensureCrewBeeConfigFile({
    configRoot,
    mode: "startup",
  });
  const written = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(result.reason, "repaired-invalid");
  assert.equal(typeof result.backupPath, "string");
  assert.equal(readFileSync(result.backupPath, "utf8"), invalidContent);
  assert.deepEqual(written, readExpectedCrewBeeConfigTemplate());
});
