import { readOpenCodeConfig, upsertCrewBeePluginEntry, writeOpenCodeConfig } from "./config-writer";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { resolveLocalTarballPath } from "./local-tarball";
import { installLocalTarball } from "./package-manager";
import { assertInstalledPluginExists, createCanonicalPluginEntry } from "./plugin-entry";
import type { InstallCommandContext, InstallCommandOptions, InstallResult } from "./types";
import { ensureInstallWorkspace } from "./workspace";

export async function installCrewBee(input: {
  context: InstallCommandContext;
  options: InstallCommandOptions;
}): Promise<InstallResult> {
  if (input.options.source === "registry") {
    throw new Error("Registry install is not implemented yet. CrewBee currently supports local package install only.");
  }

  const configPath = resolveOpenCodeConfigPath(input.options.configPath);
  const installRoot = resolveInstallRoot(input.options.installRoot);
  const workspace = ensureInstallWorkspace(installRoot, input.options.dryRun);
  const tarballPath = resolveLocalTarballPath({
    localTarballPath: input.options.localTarballPath,
    searchRoots: [input.context.cwd, input.context.packageRoot],
  });

  installLocalTarball({
    dryRun: input.options.dryRun,
    installRoot,
    tarballPath,
  });

  if (!input.options.dryRun) {
    assertInstalledPluginExists(installRoot);
  }

  const pluginEntry = createCanonicalPluginEntry(installRoot);
  const configDocument = readOpenCodeConfig(configPath);
  const pluginUpdate = upsertCrewBeePluginEntry(configDocument.config, pluginEntry);

  if (!input.options.dryRun && pluginUpdate.changed) {
    writeOpenCodeConfig(configPath, configDocument.config);
  }

  return {
    configChanged: pluginUpdate.changed,
    configPath,
    dryRun: input.options.dryRun,
    installRoot,
    migratedEntries: pluginUpdate.migratedEntries,
    pluginEntry,
    source: input.options.source,
    tarballPath,
    workspaceCreated: workspace.created,
  };
}
