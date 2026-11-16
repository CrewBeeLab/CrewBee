import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Real host loading without credentials or a model request. Keep the isolated
// root on failure as diagnostic evidence; do not touch the user's installation.
const executable = path.resolve(process.argv[2]);
const major = Number(process.argv[3]);
assert.ok(major === 1 || major === 2, "usage: node scripts/smoke-opencode-host.mjs <executable> <1|2>");
const root = mkdtempSync(path.join(os.tmpdir(), "crewbee-host-smoke-"));
const project = path.join(root, "project");
const configRoot = path.join(root, "config");
mkdirSync(project);
mkdirSync(configRoot);
const packageRoot = process.cwd();
const config = major === 1
  ? { plugin: [pathToFileURL(path.join(packageRoot, "dist", "opencode-plugin.mjs")).href] }
  : { plugins: [{ package: `file:${packageRoot.replaceAll("\\", "/")}` }] };
writeFileSync(path.join(configRoot, "opencode.json"), JSON.stringify(config));
const env = {
  ...process.env,
  HOME: root, USERPROFILE: root,
  OPENCODE_CONFIG_DIR: configRoot,
  XDG_CONFIG_HOME: path.join(root, "xdg-config"),
  XDG_DATA_HOME: path.join(root, "data"),
  XDG_CACHE_HOME: path.join(root, "cache"),
  XDG_STATE_HOME: path.join(root, "state"),
  OPENCODE_DISABLE_PROJECT_CONFIG: "true",
  OPENCODE_DISABLE_MODELS_FETCH: "true",
  CREWBEE_AUTO_UPDATE: "0",
};
const args = major === 1 ? ["debug", "agent", "coding-leader"] : ["debug", "agents", "--standalone"];
const result = spawnSync(executable, args, {
  cwd: project, env, encoding: "utf8", timeout: 120_000,
  shell: process.platform === "win32" && /\.cmd$/i.test(executable),
});
writeFileSync(path.join(root, "stdout.log"), result.stdout ?? "");
writeFileSync(path.join(root, "stderr.log"), result.stderr ?? "");
assert.equal(result.status, 0, `Host failed: ${result.error ?? result.stderr}. Evidence: ${root}`);
const parsed = JSON.parse(result.stdout);
if (major === 1) {
  assert.equal(parsed.name, "coding-leader");
  assert.equal(parsed.mode, "primary");
} else {
  const ids = new Set(parsed.map((agent) => agent.id));
  for (const id of ["coding-leader", "coding-executor", "coding-coordination-leader", "coding-reviewer", "coding-codebase-explorer", "coding-web-researcher", "coding-principal-advisor", "coding-multimodal-looker"]) {
    assert.ok(ids.has(id), `Missing projected agent ${id}`);
  }
  assert.equal(parsed.find((agent) => agent.id === "build")?.hidden, true);
}
console.log(`OpenCode V${major} host loading passed. Evidence: ${root}`);
