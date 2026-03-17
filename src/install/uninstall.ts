import { readOpenCodeConfig, removeCrewBeePluginEntries, writeOpenCodeConfig } from "./config-writer";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { uninstallCrewBeePackage } from "./package-manager";
import type { UninstallOptions, UninstallResult } from "./types";

export async function uninstallCrewBee(options: UninstallOptions): Promise<UninstallResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const configDocument = readOpenCodeConfig(configPath);
  const removal = removeCrewBeePluginEntries(configDocument.config);

  if (!options.dryRun && removal.changed) {
    writeOpenCodeConfig(configPath, configDocument.config);
  }

  const packageRemoved = uninstallCrewBeePackage({
    dryRun: options.dryRun,
    installRoot,
  });

  return {
    configChanged: removal.changed,
    configPath,
    dryRun: options.dryRun,
    installRoot,
    packageRemoved,
    removedEntries: removal.removedEntries,
  };
}
