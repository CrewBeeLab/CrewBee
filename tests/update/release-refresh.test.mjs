import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { findConfiguredCrewBeeReleaseIntent } from "../../dist/src/update/intent.js";
import { runBackgroundReleaseRefresh, shouldEnableCrewBeeReleaseRefresh, startBackgroundReleaseRefresh } from "../../dist/src/update/refresh.js";
import { readCrewBeeReleaseState, writeCrewBeeReleaseState } from "../../dist/src/update/state.js";

async function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function writeConfigRoot(root, pluginEntry) {
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "opencode.json"), JSON.stringify({ plugin: [pluginEntry] }, null, 2), "utf8");
}

function createPluginInput() {
  return {
    client: { app: { log: async () => {} } },
    project: { id: "test-project", directory: process.cwd(), worktree: process.cwd() },
    directory: process.cwd(),
    worktree: process.cwd(),
    $() {
      throw new Error("shell unavailable");
    },
  };
}

test("findConfiguredCrewBeeReleaseIntent resolves plain crewbee to latest workspace", () => {
  const workspace = path.join(os.tmpdir(), `crewbee-update-intent-${Date.now()}`);
  const configRoot = path.join(workspace, ".config", "opencode");
  const cacheRoot = path.join(workspace, ".cache");

  return withEnv({ OPENCODE_CONFIG_DIR: configRoot, XDG_CACHE_HOME: cacheRoot }, () => {
    writeConfigRoot(configRoot, "crewbee");
    const intent = findConfiguredCrewBeeReleaseIntent();
    assert.equal(intent?.entry, "crewbee");
    assert.equal(intent?.requestedVersion, "latest");
    assert.equal(intent?.isPinned, false);
    assert.match(intent?.workspaceRoot ?? "", /packages[\\/]crewbee@latest$/);
  });
});

test("runBackgroundReleaseRefresh skips pinned versions", async () => {
  const workspace = path.join(os.tmpdir(), `crewbee-update-pinned-${Date.now()}`);
  const configRoot = path.join(workspace, ".config", "opencode");
  const cacheRoot = path.join(workspace, ".cache");
  let installCalls = 0;

  await withEnv({ OPENCODE_CONFIG_DIR: configRoot, XDG_CACHE_HOME: cacheRoot }, async () => {
    writeConfigRoot(configRoot, "crewbee@0.1.4");
    const result = await runBackgroundReleaseRefresh(createPluginInput(), {
      async fetchJson() {
        return { "dist-tags": { latest: "0.1.5" } };
      },
      async runInstall() {
        installCalls += 1;
        return true;
      },
    });

    assert.equal(result.reason, "pinned-version");
    assert.equal(installCalls, 0);
  });
});

test("runBackgroundReleaseRefresh syncs workspace dependency intent and records success", async () => {
  const workspace = path.join(os.tmpdir(), `crewbee-update-refresh-${Date.now()}`);
  const configRoot = path.join(workspace, ".config", "opencode");
  const cacheRoot = path.join(workspace, ".cache");

  await withEnv({ OPENCODE_CONFIG_DIR: configRoot, XDG_CACHE_HOME: cacheRoot }, async () => {
    writeConfigRoot(configRoot, "crewbee");
    const workspaceRoot = path.join(cacheRoot, "opencode", "packages", "crewbee@latest");
    const installedRoot = path.join(workspaceRoot, "node_modules", "crewbee");
    mkdirSync(installedRoot, { recursive: true });
    writeFileSync(path.join(installedRoot, "package.json"), JSON.stringify({ name: "crewbee", version: "0.1.3" }, null, 2), "utf8");

    let installCalled = false;
    const result = await runBackgroundReleaseRefresh(createPluginInput(), {
      async fetchJson() {
        return { "dist-tags": { latest: "0.1.5" } };
      },
      async runInstall(dir) {
        installCalled = true;
        assert.equal(dir, workspaceRoot);
        assert.equal(existsSync(path.join(workspaceRoot, "node_modules", "crewbee")), false);
        const pkg = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));
        assert.equal(pkg.dependencies.crewbee, "0.1.5");
        return true;
      },
    });

    const state = readCrewBeeReleaseState();
    assert.equal(result.reason, "refresh-required");
    assert.equal(result.latestVersion, "0.1.5");
    assert.equal(installCalled, true);
    assert.equal(state.lastKnownVersion, "0.1.5");
  });
});

test("startBackgroundReleaseRefresh is disabled unless explicitly enabled", async () => {
  let called = false;
  await withEnv({ CREWBEE_AUTO_UPDATE: undefined, NODE_ENV: "test" }, async () => {
    startBackgroundReleaseRefresh(createPluginInput(), {
      async fetchJson() {
        called = true;
        return {};
      },
      async runInstall() {
        called = true;
        return true;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(called, false);
  });
});

test("shouldEnableCrewBeeReleaseRefresh defaults to off in test and dev, on in installed env", async () => {
  const repoRoot = process.cwd();
  const installedRoot = path.join(os.tmpdir(), `crewbee-installed-${Date.now()}`);
  mkdirSync(installedRoot, { recursive: true });

  await withEnv({ CREWBEE_AUTO_UPDATE: undefined, NODE_ENV: "test" }, async () => {
    assert.equal(shouldEnableCrewBeeReleaseRefresh(repoRoot), false);
    assert.equal(shouldEnableCrewBeeReleaseRefresh(installedRoot), false);
  });

  await withEnv({ CREWBEE_AUTO_UPDATE: undefined, NODE_ENV: "production" }, async () => {
    assert.equal(shouldEnableCrewBeeReleaseRefresh(repoRoot), false);
    assert.equal(shouldEnableCrewBeeReleaseRefresh(installedRoot), true);
  });
});

test("runBackgroundReleaseRefresh respects failure cooldown", async () => {
  const workspace = path.join(os.tmpdir(), `crewbee-update-cooldown-${Date.now()}`);
  const configRoot = path.join(workspace, ".config", "opencode");
  const cacheRoot = path.join(workspace, ".cache");

  await withEnv({ OPENCODE_CONFIG_DIR: configRoot, XDG_CACHE_HOME: cacheRoot }, async () => {
    writeConfigRoot(configRoot, "crewbee");
    const workspaceRoot = path.join(cacheRoot, "opencode", "packages", "crewbee@latest");
    mkdirSync(path.join(workspaceRoot, "node_modules", "crewbee"), { recursive: true });
    writeFileSync(path.join(workspaceRoot, "node_modules", "crewbee", "package.json"), JSON.stringify({ name: "crewbee", version: "0.1.3" }, null, 2), "utf8");

    let installCalls = 0;
    let fetchCalls = 0;
    const deps = {
      async fetchJson() {
        fetchCalls += 1;
        return { "dist-tags": { latest: "0.1.5" } };
      },
      async runInstall() {
        installCalls += 1;
        return false;
      },
    };

    const first = await runBackgroundReleaseRefresh(createPluginInput(), deps);
    const second = await runBackgroundReleaseRefresh(createPluginInput(), deps);

    assert.equal(installCalls, 1);
    assert.equal(fetchCalls, 2);
    assert.equal(first.reason, "refresh-required");
    assert.equal(second.reason, "refresh-required");
    assert.equal(second.latestVersion, "0.1.5");
  });
});

test("runBackgroundReleaseRefresh bypasses stale success state when registry has a newer latest", async () => {
  const workspace = path.join(os.tmpdir(), `crewbee-update-success-stale-${Date.now()}`);
  const configRoot = path.join(workspace, ".config", "opencode");
  const cacheRoot = path.join(workspace, ".cache");

  await withEnv({ OPENCODE_CONFIG_DIR: configRoot, XDG_CACHE_HOME: cacheRoot }, async () => {
    writeConfigRoot(configRoot, "crewbee@latest");
    const workspaceRoot = path.join(cacheRoot, "opencode", "packages", "crewbee@latest");
    mkdirSync(path.join(workspaceRoot, "node_modules", "crewbee"), { recursive: true });
    writeFileSync(path.join(workspaceRoot, "node_modules", "crewbee", "package.json"), JSON.stringify({ name: "crewbee", version: "0.1.16" }, null, 2), "utf8");
    writeCrewBeeReleaseState({
      lastCheckedAt: Date.now(),
      lastKnownVersion: "0.1.16",
      lastSucceededAt: Date.now(),
    });

    let installCalls = 0;
    const result = await runBackgroundReleaseRefresh(createPluginInput(), {
      async fetchJson() {
        return { "dist-tags": { latest: "0.1.17" } };
      },
      async runInstall() {
        installCalls += 1;
        return true;
      },
    });

    assert.equal(result.reason, "refresh-required");
    assert.equal(result.latestVersion, "0.1.17");
    assert.equal(installCalls, 1);
  });
});

test("runBackgroundReleaseRefresh retries immediately when the latest target changes", async () => {
  const workspace = path.join(os.tmpdir(), `crewbee-update-new-target-${Date.now()}`);
  const configRoot = path.join(workspace, ".config", "opencode");
  const cacheRoot = path.join(workspace, ".cache");

  await withEnv({ OPENCODE_CONFIG_DIR: configRoot, XDG_CACHE_HOME: cacheRoot }, async () => {
    writeConfigRoot(configRoot, "crewbee@latest");
    const workspaceRoot = path.join(cacheRoot, "opencode", "packages", "crewbee@latest");
    mkdirSync(path.join(workspaceRoot, "node_modules", "crewbee"), { recursive: true });
    writeFileSync(path.join(workspaceRoot, "node_modules", "crewbee", "package.json"), JSON.stringify({ name: "crewbee", version: "0.1.3" }, null, 2), "utf8");
    writeCrewBeeReleaseState({
      lastCheckedAt: Date.now(),
      lastAttemptedVersion: "0.1.5",
      lastFailure: "Failed to install 0.1.5",
      lastFailureAt: Date.now(),
      lastKnownVersion: "0.1.3",
    });

    let installCalls = 0;
    const result = await runBackgroundReleaseRefresh(createPluginInput(), {
      async fetchJson() {
        return { "dist-tags": { latest: "0.1.6" } };
      },
      async runInstall() {
        installCalls += 1;
        return true;
      },
    });

    assert.equal(result.reason, "refresh-required");
    assert.equal(result.latestVersion, "0.1.6");
    assert.equal(installCalls, 1);
  });
});
