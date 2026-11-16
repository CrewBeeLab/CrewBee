import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseJsoncText } from "./jsonc";

export interface OpenCodeConfigDocument {
  config: Record<string, unknown>;
  existed: boolean;
  path: string;
}

export interface OpenCodeConfigBackup {
  backupPath?: string;
  configPath: string;
  existed: boolean;
}

export interface PluginUpdateResult {
  changed: boolean;
  migratedEntries: string[];
}

export interface PluginRemovalResult {
  changed: boolean;
  removedEntries: string[];
}

export function readOpenCodeConfig(configPath: string): OpenCodeConfigDocument {
  if (!existsSync(configPath)) {
    return {
      config: {},
      existed: false,
      path: configPath,
    };
  }

  return {
    config: parseJsoncText(readFileSync(configPath, "utf8")),
    existed: true,
    path: configPath,
  };
}

export function writeOpenCodeConfig(configPath: string, config: Record<string, unknown>): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function backupOpenCodeConfig(configPath: string): OpenCodeConfigBackup {
  if (!existsSync(configPath)) {
    return {
      configPath,
      existed: false,
    };
  }

  const backupPath = resolveOpenCodeConfigBackupPath(configPath);
  mkdirSync(path.dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, readFileSync(configPath, "utf8"), "utf8");

  return {
    backupPath,
    configPath,
    existed: true,
  };
}

export function restoreOpenCodeConfigBackup(backup: OpenCodeConfigBackup): void {
  if (!backup.existed) {
    rmSync(backup.configPath, { force: true });
    return;
  }

  if (!backup.backupPath || !existsSync(backup.backupPath)) {
    throw new Error(`OpenCode config backup is missing: ${backup.backupPath ?? "none"}`);
  }

  mkdirSync(path.dirname(backup.configPath), { recursive: true });
  writeFileSync(backup.configPath, readFileSync(backup.backupPath, "utf8"), "utf8");
}

function resolveOpenCodeConfigBackupPath(configPath: string): string {
  const parsed = path.parse(configPath);
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return path.join(parsed.dir, `${parsed.base}.backup-${timestamp}`);
}

export type OpenCodePluginFormat = "v1" | "v2";

export function resolveOpenCodePluginFormat(config: Record<string, unknown>, version?: string): OpenCodePluginFormat {
  const major = version?.match(/\bv?([12])\.\d+\.\d+\b/)?.[1];
  if (major === "2") return "v2";
  if (major === "1") return "v1";
  return Array.isArray(config.plugins) ? "v2" : "v1";
}

function writePluginEntries(config: Record<string, unknown>, entries: unknown[], format: OpenCodePluginFormat): void {
  if (format === "v2") {
    config.plugins = entries;
    delete config.plugin;
  } else {
    config.plugin = entries.map((entry) => isPluginEntryObject(entry) && typeof entry.package === "string"
      ? (entry.options ? [entry.package, entry.options] : entry.package)
      : entry);
    delete config.plugins;
  }
}

export function upsertCrewBeePluginEntry(
  config: Record<string, unknown>, pluginEntry: string,
  format: OpenCodePluginFormat = resolveOpenCodePluginFormat(config),
): PluginUpdateResult {
  const before = JSON.stringify(config);
  const currentPlugins = getRawPluginArray(config);
  const nextPlugins: unknown[] = [];
  const migratedEntries: string[] = [];
  let hasCanonicalEntry = false;

  for (const value of currentPlugins) {
    if (typeof value !== "string" && !isPluginEntryObject(value)) {
      nextPlugins.push(value);
      continue;
    }

    const reference = readPluginEntryReference(value);
    if (reference === pluginEntry) {
      if (!hasCanonicalEntry) {
        nextPlugins.push(isPluginEntryObject(value) ? { ...value, package: pluginEntry } : pluginEntry);
        hasCanonicalEntry = true;
      }
      continue;
    }

    if (reference && isCrewBeePluginReference(reference)) {
      migratedEntries.push(reference);
      if (!hasCanonicalEntry) {
        nextPlugins.push(isPluginEntryObject(value) ? { ...value, package: pluginEntry } : pluginEntry);
        hasCanonicalEntry = true;
      }
      continue;
    }

    nextPlugins.push(value);
  }

  if (!hasCanonicalEntry) {
    nextPlugins.push(pluginEntry);
  }

  writePluginEntries(config, nextPlugins, format);
  return { changed: JSON.stringify(config) !== before, migratedEntries };
}

export function removeCrewBeePluginEntries(config: Record<string, unknown>): PluginRemovalResult {
  const currentPlugins = getRawPluginArray(config);
  const removedEntries = currentPlugins
    .map((value) => readPluginEntryReference(value))
    .filter((value): value is string => typeof value === "string" && isCrewBeePluginReference(value));
  const changed = removedEntries.length > 0;

  if (changed) {
    // Uninstall must not migrate foreign plugin configuration or discard options.
    for (const key of ["plugin", "plugins"]) {
      if (Array.isArray(config[key])) {
        config[key] = config[key].filter((entry: unknown) => {
          const reference = readPluginEntryReference(normalizePluginEntry(entry));
          return !reference || !isCrewBeePluginReference(reference);
        });
      }
    }
  }

  return {
    changed,
    removedEntries,
  };
}

export function findCrewBeePluginEntries(config: Record<string, unknown>): string[] {
  return getRawPluginArray(config)
    .map((value) => readPluginEntryReference(value))
    .filter((value): value is string => typeof value === "string" && isCrewBeePluginReference(value));
}

function getRawPluginArray(config: Record<string, unknown>): unknown[] {
  const merged: unknown[] = [];

  if (Array.isArray(config.plugins)) {
    merged.push(...config.plugins.map(normalizePluginEntry));
  }

  // V1 legacy key: migrate its entries (normalizing V1 tuple form to V2 object form).
  if (Array.isArray(config.plugin)) {
    merged.push(...config.plugin.map(normalizePluginEntry));
  }

  return merged;
}

function normalizePluginEntry(entry: unknown): unknown {
  if (Array.isArray(entry) && entry.length >= 1 && typeof entry[0] === "string") {
    const [name, options] = entry;
    if (options && typeof options === "object" && !Array.isArray(options)) {
      return { package: name, options };
    }
    return name;
  }
  return entry;
}

function isPluginEntryObject(value: unknown): value is { package?: unknown; options?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPluginEntryReference(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (isPluginEntryObject(value) && typeof value.package === "string") {
    return value.package;
  }

  return undefined;
}

function isCrewBeePluginReference(value: string): boolean {
  if (value === "crewbee" || value.startsWith("crewbee@")) {
    return true;
  }

  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/node_modules/crewbee/") || normalized.endsWith("/entry/crewbee-opencode-entry.mjs");
}
