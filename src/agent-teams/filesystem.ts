import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { AgentTeamDefinition } from "../core";

import { TEAM_CONFIG_ROOT } from "./constants";
import { resolveTeamDocumentation } from "./documentation";
import { mapAgentProfile, mapTeamManifest, mapTeamPolicy } from "./parsers";

const TEAM_MANIFEST_FILE = "team.manifest.yaml";
const TEAM_POLICY_FILE = "team.policy.yaml";

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
