import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function getCrossPlatformConfigRoot(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const configHome = xdgConfigHome && xdgConfigHome.length > 0
    ? xdgConfigHome
    : path.join(os.homedir(), ".config");

  return path.join(configHome, "opencode");
}

function hasExistingConfig(configRoot: string): boolean {
  return existsSync(path.join(configRoot, "opencode.json")) || existsSync(path.join(configRoot, "opencode.jsonc"));
}

export function resolveOpenCodeConfigRoot(configPath?: string): string {
  if (configPath) {
    return path.dirname(path.resolve(configPath));
  }

  const overrideRoot = process.env.OPENCODE_CONFIG_DIR?.trim();
  if (overrideRoot) {
    return path.resolve(overrideRoot);
  }

  const crossPlatformRoot = getCrossPlatformConfigRoot();

  if (process.platform !== "win32") {
    return crossPlatformRoot;
  }

  if (hasExistingConfig(crossPlatformRoot)) {
    return crossPlatformRoot;
  }

  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const appDataRoot = path.join(appData, "opencode");

  if (hasExistingConfig(appDataRoot)) {
    return appDataRoot;
  }

  return crossPlatformRoot;
}

export function resolveOpenCodeConfigPath(configPath?: string): string {
  if (configPath) {
    return path.resolve(configPath);
  }

  const configRoot = resolveOpenCodeConfigRoot();
  const jsoncPath = path.join(configRoot, "opencode.jsonc");
  const jsonPath = path.join(configRoot, "opencode.json");

  if (existsSync(jsoncPath)) {
    return jsoncPath;
  }

  return jsonPath;
}

export function resolveInstallRoot(installRoot?: string): string {
  if (installRoot) {
    return path.resolve(installRoot);
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  const cacheRoot = xdgCacheHome && xdgCacheHome.length > 0
    ? xdgCacheHome
    : path.join(os.homedir(), ".cache");

  return path.join(cacheRoot, "opencode");
}
