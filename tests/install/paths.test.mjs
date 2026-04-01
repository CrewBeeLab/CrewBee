import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { resolveInstallRoot, resolveOpenCodeConfigPath, resolveOpenCodeConfigRoot } from "../../dist/src/install/index.js";

test("install roots honor explicit overrides and XDG defaults", () => {
  const previousConfigHome = process.env.XDG_CONFIG_HOME;
  const previousCacheHome = process.env.XDG_CACHE_HOME;

  process.env.XDG_CONFIG_HOME = path.join(os.tmpdir(), "crewbee-config-home");
  process.env.XDG_CACHE_HOME = path.join(os.tmpdir(), "crewbee-cache-home");

  try {
    assert.equal(resolveOpenCodeConfigRoot(), path.join(process.env.XDG_CONFIG_HOME, "opencode"));
    assert.equal(resolveOpenCodeConfigPath(), path.join(process.env.XDG_CONFIG_HOME, "opencode", "opencode.json"));
    assert.equal(resolveInstallRoot(), path.join(process.env.XDG_CACHE_HOME, "opencode"));
    assert.equal(resolveInstallRoot("./custom-install-root"), path.resolve("./custom-install-root"));
    assert.equal(resolveOpenCodeConfigPath("./custom-config.json"), path.resolve("./custom-config.json"));
  } finally {
    if (previousConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousConfigHome;
    }

    if (previousCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = previousCacheHome;
    }
  }
});
