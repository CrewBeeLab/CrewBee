import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { AgentTeamDefinition } from "../core";

import { TEAM_CONFIG_ROOT } from "./constants";
import { resolveTeamDocumentation } from "./documentation";
import { mapAgentProfile, mapSharedCapabilities, mapTeamManifest, mapTeamPolicy } from "./parsers";

const TEAM_MANIFEST_FILE = "team.manifest.yaml";
const TEAM_POLICY_FILE = "team.policy.yaml";
const SHARED_CAPABILITIES_FILE = "shared-capabilities.yaml";

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
  const policy = mapTeamPolicy(path.join(teamDir, TEAM_POLICY_FILE));
  const sharedCapabilitiesPath = path.join(teamDir, SHARED_CAPABILITIES_FILE);
  const agentsDir = path.join(teamDir, "agents");

  if (!existsSync(agentsDir)) {
    throw new Error(`${teamDir} is missing agents/.`);
  }

  const agents = readdirSync(agentsDir)
    .filter((entry) => entry.endsWith(".agent.md"))
    .sort()
    .map((entry) => mapAgentProfile(path.join(agentsDir, entry)));

  return {
    manifest,
    policy,
    sharedCapabilities: existsSync(sharedCapabilitiesPath) ? mapSharedCapabilities(sharedCapabilitiesPath) : undefined,
    agents,
    documentation: resolveTeamDocumentation(teamDir, workspaceRoot),
  };
}
