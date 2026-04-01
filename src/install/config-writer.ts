import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseJsoncText } from "./jsonc";

export interface OpenCodeConfigDocument {
  config: Record<string, unknown>;
  existed: boolean;
  path: string;
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

export function upsertCrewBeePluginEntry(config: Record<string, unknown>, pluginEntry: string): PluginUpdateResult {
  const currentPlugins = getRawPluginArray(config);
  const nextPlugins: unknown[] = [];
  const migratedEntries: string[] = [];
  let hasCanonicalEntry = false;

  for (const value of currentPlugins) {
    if (typeof value !== "string") {
      nextPlugins.push(value);
      continue;
    }

    if (value === pluginEntry) {
      if (!hasCanonicalEntry) {
        nextPlugins.push(pluginEntry);
        hasCanonicalEntry = true;
      }
      continue;
    }

    if (isCrewBeePluginReference(value)) {
      migratedEntries.push(value);
      if (!hasCanonicalEntry) {
        nextPlugins.push(pluginEntry);
        hasCanonicalEntry = true;
      }
      continue;
    }

    nextPlugins.push(value);
  }

  if (!hasCanonicalEntry) {
    nextPlugins.push(pluginEntry);
  }

  const changed = !arePluginArraysEqual(currentPlugins, nextPlugins);

  config.plugin = nextPlugins;
  return { changed, migratedEntries };
}

export function removeCrewBeePluginEntries(config: Record<string, unknown>): PluginRemovalResult {
  const currentPlugins = getRawPluginArray(config);
  const removedEntries = currentPlugins.filter((value): value is string => typeof value === "string" && isCrewBeePluginReference(value));
  const nextPlugins = currentPlugins.filter((value) => typeof value !== "string" || !isCrewBeePluginReference(value));
  const changed = removedEntries.length > 0;

  if (changed) {
    config.plugin = nextPlugins;
  }

  return {
    changed,
    removedEntries,
  };
}

export function findCrewBeePluginEntries(config: Record<string, unknown>): string[] {
  return getRawPluginArray(config).filter((value): value is string => typeof value === "string" && isCrewBeePluginReference(value));
}

function getRawPluginArray(config: Record<string, unknown>): unknown[] {
  return Array.isArray(config.plugin)
    ? [...config.plugin]
    : [];
}

function arePluginArraysEqual(left: unknown[], right: unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isCrewBeePluginReference(value: string): boolean {
  if (value === "crewbee" || value.startsWith("crewbee@")) {
    return true;
  }

  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/node_modules/crewbee/") || normalized.endsWith("/entry/crewbee-opencode-entry.mjs");
}
