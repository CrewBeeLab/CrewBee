import path from "node:path";

import { ensureCrewBeeConfigFile } from "../agent-teams";

import { backupOpenCodeConfig, readOpenCodeConfig, restoreOpenCodeConfigBackup, upsertCrewBeePluginEntry, writeOpenCodeConfig } from "./opencode-config-file";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { resolveLocalTarballPath } from "./local-tarball";
import { cleanupLegacyCrewBeePackage, installLocalTarball, installRegistryPackage } from "./package-installation";
import { assertInstalledPluginExists, createCanonicalPluginEntry, resolvePackageWorkspaceRoot } from "./plugin-entry";
import type { InstallCommandContext, InstallCommandOptions, InstallResult } from "./types";
import { ensureInstallWorkspace } from "./workspace";

export async function installCrewBee(input: {
  context: InstallCommandContext;
  options: InstallCommandOptions;
}): Promise<InstallResult> {
  const configPath = resolveOpenCodeConfigPath(input.options.configPath);
  const installRoot = resolveInstallRoot(input.options.installRoot);
  const packageWorkspaceRoot = resolvePackageWorkspaceRoot(installRoot);
  const workspace = ensureInstallWorkspace(installRoot, input.options.dryRun);
  let tarballPath: string | undefined;
  let packageSpec: string | undefined;

  if (input.options.source === "local") {
    tarballPath = resolveLocalTarballPath({
      localTarballPath: input.options.localTarballPath,
      searchRoots: [input.context.cwd, input.context.packageRoot],
    });

    installLocalTarball({
      dryRun: input.options.dryRun,
      installRoot: packageWorkspaceRoot,
      tarballPath,
    });
  } else {
    packageSpec = input.options.channel === "next" ? "crewbee@next" : "crewbee@latest";
    installRegistryPackage({
      dryRun: input.options.dryRun,
      installRoot: packageWorkspaceRoot,
      packageSpec,
    });
  }

  const legacyPackageRemoved = cleanupLegacyCrewBeePackage({
    dryRun: input.options.dryRun,
    installRoot,
  });

  if (!input.options.dryRun) {
    assertInstalledPluginExists(installRoot);
  }

  const pluginEntry = createCanonicalPluginEntry(installRoot);
  const configDocument = readOpenCodeConfig(configPath);
  const pluginUpdate = upsertCrewBeePluginEntry(configDocument.config, pluginEntry);
  const configBackup = !input.options.dryRun && pluginUpdate.changed
    ? backupOpenCodeConfig(configPath)
    : undefined;

  try {
    if (!input.options.dryRun && pluginUpdate.changed) {
      writeOpenCodeConfig(configPath, configDocument.config);
    }

    const crewbeeConfigUpdate = ensureCrewBeeConfigFile({
      configRoot: path.dirname(configPath),
      dryRun: input.options.dryRun,
      mode: "install",
    });

    return {
      backupPath: configBackup?.backupPath,
      configChanged: pluginUpdate.changed,
      configPath,
      crewbeeConfigChanged: crewbeeConfigUpdate.changed,
      crewbeeConfigPath: crewbeeConfigUpdate.configPath,
      crewbeeConfigReason: crewbeeConfigUpdate.reason,
      dryRun: input.options.dryRun,
      installRoot,
      packageWorkspaceRoot,
      legacyPackageRemoved,
      migratedEntries: pluginUpdate.migratedEntries,
      pluginEntry,
      packageSpec,
      source: input.options.source,
      tarballPath,
      workspaceCreated: workspace.created,
    };
  } catch (error) {
    if (configBackup) {
      restoreOpenCodeConfigBackup(configBackup);
    }

    throw error;
  }
}
