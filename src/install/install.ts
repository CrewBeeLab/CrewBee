import path from "node:path";

import { ensureCrewBeeConfigFile } from "../agent-teams";
import { readPackageVersion } from "../version/package-version";

import { readOpenCodeConfig, upsertCrewBeePluginEntry, writeOpenCodeConfig } from "./config-writer";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { resolveLocalTarballPath } from "./local-tarball";
import { installLocalTarball, installRegistryPackage } from "./package-manager";
import { assertInstalledPluginExists, createCanonicalPluginEntry } from "./plugin-entry";
import type { InstallCommandContext, InstallCommandOptions, InstallResult } from "./types";
import { ensureInstallWorkspace } from "./workspace";

export async function installCrewBee(input: {
  context: InstallCommandContext;
  options: InstallCommandOptions;
}): Promise<InstallResult> {
  const configPath = resolveOpenCodeConfigPath(input.options.configPath);
  const installRoot = resolveInstallRoot(input.options.installRoot);
  const workspace = ensureInstallWorkspace(installRoot, input.options.dryRun);
  const currentVersion = readPackageVersion(input.context.packageRoot);
  let tarballPath: string | undefined;
  let packageSpec: string | undefined;

  if (input.options.source === "local") {
    tarballPath = resolveLocalTarballPath({
      localTarballPath: input.options.localTarballPath,
      searchRoots: [input.context.cwd, input.context.packageRoot],
    });

    installLocalTarball({
      dryRun: input.options.dryRun,
      installRoot,
      tarballPath,
    });
  } else {
    packageSpec = `crewbee@${currentVersion}`;
    installRegistryPackage({
      dryRun: input.options.dryRun,
      installRoot,
      packageSpec,
    });
  }

  if (!input.options.dryRun) {
    assertInstalledPluginExists(installRoot);
  }

  const pluginEntry = createCanonicalPluginEntry(installRoot);
  const configDocument = readOpenCodeConfig(configPath);
  const pluginUpdate = upsertCrewBeePluginEntry(configDocument.config, pluginEntry);

  if (!input.options.dryRun && pluginUpdate.changed) {
    writeOpenCodeConfig(configPath, configDocument.config);
  }

  const crewbeeConfigUpdate = ensureCrewBeeConfigFile({
    configRoot: path.dirname(configPath),
    dryRun: input.options.dryRun,
    mode: "install",
  });

  return {
    configChanged: pluginUpdate.changed,
    configPath,
    crewbeeConfigChanged: crewbeeConfigUpdate.changed,
    crewbeeConfigPath: crewbeeConfigUpdate.configPath,
    crewbeeConfigReason: crewbeeConfigUpdate.reason,
    dryRun: input.options.dryRun,
    installRoot,
    migratedEntries: pluginUpdate.migratedEntries,
    pluginEntry,
    packageSpec,
    source: input.options.source,
    tarballPath,
    workspaceCreated: workspace.created,
  };
}
