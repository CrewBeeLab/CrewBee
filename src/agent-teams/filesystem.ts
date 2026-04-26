import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AgentTeamDefinition } from "../core";
import { resolveOpenCodeConfigRoot } from "../install/install-root";

import type { TeamValidationIssue } from "./types";
import {
  BUILTIN_CODING_TEAM_ID,
  CREWBEE_CONFIG_FILE,
  DEFAULT_EMBEDDED_TEAM_PRIORITY,
  DEFAULT_FILE_TEAM_PRIORITY,
  TEAM_CONFIG_ROOT,
} from "./constants";
import { resolveTeamDocumentation } from "./documentation";
import { mapAgentProfile, mapTeamManifest, mapTeamPolicy } from "./parsers";

const TEAM_MANIFEST_FILE = "team.manifest.yaml";
const TEAM_POLICY_FILE = "team.policy.yaml";

interface RawCrewBeeTeamConfig {
  teams?: unknown;
}

interface RawConfiguredTeamEntry {
  id?: unknown;
  path?: unknown;
  enabled?: unknown;
  priority?: unknown;
}

export interface ConfiguredEmbeddedTeamSource {
  kind: "embedded";
  teamId: string;
  enabled: boolean;
  priority: number;
  order: number;
}

export interface ConfiguredFilesystemTeamSource {
  kind: "filesystem";
  teamDir: string;
  enabled: boolean;
  priority: number;
  order: number;
}

export type ConfiguredTeamSource = ConfiguredEmbeddedTeamSource | ConfiguredFilesystemTeamSource;

export interface CrewBeeConfigFile {
  teams: Array<Record<string, unknown>>;
}

export type CrewBeeConfigEnsureReason = "created-default" | "repaired-invalid" | "added-default-coding-team" | "unchanged";

export interface CrewBeeConfigEnsureResult {
  changed: boolean;
  backupPath?: string;
  configPath: string;
  reason: CrewBeeConfigEnsureReason;
}

function createConfigIssue(configPath: string, message: string): TeamValidationIssue {
  return {
    level: "warning",
    filePath: configPath,
    message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getOptionalPriority(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function createDefaultCodingTeamSource(): ConfiguredEmbeddedTeamSource {
  return {
    kind: "embedded",
    teamId: BUILTIN_CODING_TEAM_ID,
    enabled: true,
    priority: DEFAULT_EMBEDDED_TEAM_PRIORITY,
    order: -1,
  };
}

function createDefaultCodingTeamConfigEntry(): Record<string, unknown> {
  return {
    id: BUILTIN_CODING_TEAM_ID,
    enabled: true,
    priority: DEFAULT_EMBEDDED_TEAM_PRIORITY,
  };
}

function getPackagedTemplateRootPath(): string | undefined {
  const candidates = [
    // Runtime bundle: dist/opencode-plugin.mjs, with __dirname pointing at dist.
    path.resolve(__dirname, "..", "templates"),
    // Compiled module tests / direct imports: dist/src/agent-teams/filesystem.js.
    path.resolve(__dirname, "../../..", "templates"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function getPackagedCrewBeeConfigTemplatePath(): string | undefined {
  const templateRoot = getPackagedTemplateRootPath();
  return templateRoot ? path.join(templateRoot, CREWBEE_CONFIG_FILE) : undefined;
}

function ensurePackagedTeamTemplates(configRoot: string, dryRun?: boolean): void {
  const templateRoot = getPackagedTemplateRootPath();
  if (!templateRoot) {
    return;
  }

  const packagedTeamsRoot = path.join(templateRoot, TEAM_CONFIG_ROOT);
  if (!existsSync(packagedTeamsRoot) || dryRun) {
    return;
  }

  cpSync(packagedTeamsRoot, path.join(configRoot, TEAM_CONFIG_ROOT), {
    errorOnExist: false,
    force: false,
    recursive: true,
  });
}

function isCrewBeeConfigFile(value: unknown): value is CrewBeeConfigFile {
  return isRecord(value) && Array.isArray(value.teams);
}

export function createDefaultCrewBeeConfig(): CrewBeeConfigFile {
  const templatePath = getPackagedCrewBeeConfigTemplatePath();

  if (templatePath) {
    try {
      const parsed = JSON.parse(readFileSync(templatePath, "utf8"));
      if (isCrewBeeConfigFile(parsed)) {
        return parsed;
      }
    } catch (error) {
      // Fall back to the built-in minimal config below. Invalid package templates
      // should not block installation or startup self-repair.
      void error;
    }
  }

  return {
    teams: [createDefaultCodingTeamConfigEntry()],
  };
}

function writeCrewBeeConfig(configPath: string, config: CrewBeeConfigFile): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function resolveCrewBeeConfigBackupPath(configPath: string): string {
  const basePath = `${configPath}.bak`;
  if (!existsSync(basePath)) {
    return basePath;
  }

  let index = 1;
  while (true) {
    const nextPath = `${basePath}.${index}`;
    if (!existsSync(nextPath)) {
      return nextPath;
    }

    index += 1;
  }
}

function backupCrewBeeConfig(configPath: string, rawText: string): string {
  const backupPath = resolveCrewBeeConfigBackupPath(configPath);
  mkdirSync(path.dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, rawText, "utf8");
  return backupPath;
}

function parseCrewBeeConfigForEnsure(configPath: string): {
  config?: Record<string, unknown>;
  rawText?: string;
  valid: boolean;
} {
  if (!existsSync(configPath)) {
    return { valid: false };
  }

  try {
    const rawText = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(rawText);
    if (!isRecord(parsed)) {
      return { rawText, valid: false };
    }

    if (parsed.teams !== undefined && !Array.isArray(parsed.teams)) {
      return { rawText, valid: false };
    }

    return { config: parsed, rawText, valid: true };
  } catch {
    return { rawText: readFileSync(configPath, "utf8"), valid: false };
  }
}

function createUpdatedCrewBeeConfigWithDefaultTeam(config: Record<string, unknown>): {
  changed: boolean;
  next: CrewBeeConfigFile;
} {
  const rawTeams = config.teams;
  const teams = Array.isArray(rawTeams)
    ? rawTeams.map((entry) => (isRecord(entry) ? { ...entry } : entry))
    : [];
  const hasCodingTeam = teams.some((entry) => isRecord(entry) && entry.id === BUILTIN_CODING_TEAM_ID);

  return {
    changed: !hasCodingTeam,
    next: {
      ...config,
      teams: hasCodingTeam ? teams : [createDefaultCodingTeamConfigEntry(), ...teams],
    },
  };
}

export function ensureCrewBeeConfigFile(input: {
  configRoot?: string;
  dryRun?: boolean;
  mode: "install" | "startup";
}): CrewBeeConfigEnsureResult {
  const configRoot = input.configRoot ?? resolveOpenCodeConfigRoot();
  const configPath = resolveCrewBeeConfigPath(configRoot);

  if (!existsSync(configPath)) {
    if (!input.dryRun) {
      ensurePackagedTeamTemplates(configRoot);
      writeCrewBeeConfig(configPath, createDefaultCrewBeeConfig());
    }

    return {
      changed: true,
      configPath,
      reason: "created-default",
    };
  }

  const parsed = parseCrewBeeConfigForEnsure(configPath);
  if (!parsed.valid || !parsed.config) {
    const backupPath = !input.dryRun && parsed.rawText !== undefined
      ? backupCrewBeeConfig(configPath, parsed.rawText)
      : undefined;

    if (!input.dryRun) {
      ensurePackagedTeamTemplates(configRoot);
      writeCrewBeeConfig(configPath, createDefaultCrewBeeConfig());
    }

    return {
      changed: true,
      backupPath,
      configPath,
      reason: "repaired-invalid",
    };
  }

  if (input.mode === "startup") {
    return {
      changed: false,
      configPath,
      reason: "unchanged",
    };
  }

  const updated = createUpdatedCrewBeeConfigWithDefaultTeam(parsed.config);
  if (!updated.changed) {
    return {
      changed: false,
      configPath,
      reason: "unchanged",
    };
  }

  if (!input.dryRun) {
    writeCrewBeeConfig(configPath, updated.next);
  }

  return {
    changed: true,
    configPath,
    reason: "added-default-coding-team",
  };
}

function resolveConfiguredTeamPath(teamPath: string, configRoot: string): string {
  if (path.isAbsolute(teamPath)) {
    return path.normalize(teamPath);
  }

  if (teamPath.startsWith("~/") || teamPath.startsWith("~\\")) {
    return path.resolve(os.homedir(), teamPath.slice(2));
  }

  const relativePath = teamPath.startsWith("@") ? teamPath.slice(1) : teamPath;

  if (!relativePath.trim()) {
    throw new Error("Configured Team path must not be empty.");
  }

  return path.resolve(configRoot, relativePath);
}

function normalizeConfiguredTeamEntry(input: {
  value: unknown;
  index: number;
  configRoot: string;
  configPath: string;
}): { source?: ConfiguredTeamSource; issues: TeamValidationIssue[] } {
  if (!isRecord(input.value)) {
    return {
      issues: [createConfigIssue(input.configPath, `crewbee.json teams[${input.index}] must be an object.`)],
    };
  }

  const raw = input.value as RawConfiguredTeamEntry;
  const teamId = getOptionalString(raw.id);
  const teamPath = getOptionalString(raw.path);

  if (teamId && teamPath) {
    return {
      issues: [createConfigIssue(input.configPath, `crewbee.json teams[${input.index}] cannot declare both id and path.`)],
    };
  }

  if (!teamId && !teamPath) {
    return {
      issues: [createConfigIssue(input.configPath, `crewbee.json teams[${input.index}] must declare either id or path.`)],
    };
  }

  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
    return {
      issues: [createConfigIssue(input.configPath, `crewbee.json teams[${input.index}].enabled must be a boolean when provided.`)],
    };
  }

  if (raw.priority !== undefined && (typeof raw.priority !== "number" || !Number.isFinite(raw.priority))) {
    return {
      issues: [createConfigIssue(input.configPath, `crewbee.json teams[${input.index}].priority must be a finite number when provided.`)],
    };
  }

  if (teamId) {
    return {
      source: {
        kind: "embedded",
        teamId,
        enabled: getOptionalBoolean(raw.enabled, true),
        priority: getOptionalPriority(raw.priority, DEFAULT_EMBEDDED_TEAM_PRIORITY),
        order: input.index,
      },
      issues: [],
    };
  }

  try {
    return {
      source: {
        kind: "filesystem",
        teamDir: resolveConfiguredTeamPath(teamPath!, input.configRoot),
        enabled: getOptionalBoolean(raw.enabled, true),
        priority: getOptionalPriority(raw.priority, DEFAULT_FILE_TEAM_PRIORITY),
        order: input.index,
      },
      issues: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      issues: [createConfigIssue(input.configPath, `crewbee.json teams[${input.index}].path is invalid: ${message}`)],
    };
  }
}

function dedupeConfiguredTeamSources(input: {
  sources: ConfiguredTeamSource[];
  configPath: string;
}): { sources: ConfiguredTeamSource[]; issues: TeamValidationIssue[] } {
  const issues: TeamValidationIssue[] = [];
  const seen = new Set<string>();
  const sources = input.sources.filter((source) => {
    const key = source.kind === "embedded"
      ? `embedded:${source.teamId}`
      : `filesystem:${source.teamDir.toLowerCase()}`;

    if (seen.has(key)) {
      issues.push(createConfigIssue(input.configPath, `crewbee.json contains a duplicate Team entry for '${key}'.`));
      return false;
    }

    seen.add(key);
    return true;
  });

  return { sources, issues };
}

export function resolveCrewBeeConfigPath(configRoot: string = resolveOpenCodeConfigRoot()): string {
  return path.join(configRoot, CREWBEE_CONFIG_FILE);
}

export function listConfiguredTeamSources(configRoot: string = resolveOpenCodeConfigRoot()): {
  sources: ConfiguredTeamSource[];
  issues: TeamValidationIssue[];
} {
  const configPath = resolveCrewBeeConfigPath(configRoot);

  if (!existsSync(configPath)) {
    return {
      sources: [createDefaultCodingTeamSource()],
      issues: [],
    };
  }

  let parsed: RawCrewBeeTeamConfig;

  try {
    const rawConfig = readFileSync(configPath, "utf8");
    const value = JSON.parse(rawConfig);

    if (!isRecord(value)) {
      return {
        sources: [createDefaultCodingTeamSource()],
        issues: [createConfigIssue(configPath, "crewbee.json must contain a top-level object.")],
      };
    }

    parsed = value as RawCrewBeeTeamConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      sources: [createDefaultCodingTeamSource()],
      issues: [createConfigIssue(configPath, `Failed to parse crewbee.json: ${message}`)],
    };
  }

  if (parsed.teams !== undefined && !Array.isArray(parsed.teams)) {
    return {
      sources: [createDefaultCodingTeamSource()],
      issues: [createConfigIssue(configPath, "crewbee.json teams must be an array when provided.")],
    };
  }

  const resolved = (parsed.teams ?? []).map((value, index) => normalizeConfiguredTeamEntry({
    value,
    index,
    configRoot,
    configPath,
  }));
  const configuredSources = resolved.flatMap((entry) => (entry.source ? [entry.source] : []));
  const issues = resolved.flatMap((entry) => entry.issues);
  const withDefaultCodingTeam = configuredSources.some(
    (source) => source.kind === "embedded" && source.teamId === BUILTIN_CODING_TEAM_ID,
  )
    ? configuredSources
    : [createDefaultCodingTeamSource(), ...configuredSources];
  const deduped = dedupeConfiguredTeamSources({
    sources: withDefaultCodingTeam,
    configPath,
  });

  return {
    sources: deduped.sources,
    issues: [...issues, ...deduped.issues],
  };
}

export function resolveTeamConfigRoot(baseDir: string = process.cwd()): string {
  return path.resolve(baseDir, TEAM_CONFIG_ROOT);
}

export function listTeamDirectories(teamRoot: string = resolveTeamConfigRoot()): string[] {
  if (!existsSync(teamRoot)) {
    return [];
  }

  return readdirSync(teamRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(teamRoot, entry.name))
    .filter((teamDir) => existsSync(path.join(teamDir, TEAM_MANIFEST_FILE)))
    .sort();
}

export function loadTeamDefinitionFromDirectory(
  teamDir: string,
  workspaceRoot: string = process.cwd(),
): AgentTeamDefinition {
  const manifest = mapTeamManifest(path.join(teamDir, TEAM_MANIFEST_FILE));
  const policyPath = path.join(teamDir, TEAM_POLICY_FILE);

  if (!existsSync(policyPath)) {
    throw new Error(`${teamDir} is missing ${TEAM_POLICY_FILE}.`);
  }

  const agents = readdirSync(teamDir)
    .filter((entry) => entry.endsWith(".agent.md"))
    .sort()
    .map((entry) => mapAgentProfile(path.join(teamDir, entry)));

  if (agents.length === 0) {
    throw new Error(`${teamDir} must contain at least one *.agent.md file at the team root.`);
  }

  return {
    manifest,
    policy: mapTeamPolicy(policyPath),
    agents,
    documentation: resolveTeamDocumentation(teamDir, workspaceRoot),
  };
}
