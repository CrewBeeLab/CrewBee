import { backupOpenCodeConfig, readOpenCodeConfig, removeCrewBeePluginEntries, restoreOpenCodeConfigBackup, writeOpenCodeConfig } from "./opencode-config-file";
import { resolveOpenCodeConfigPath, resolveInstallRoot } from "./install-root";
import { uninstallCrewBeePackage } from "./package-installation";
import type { UninstallOptions, UninstallResult } from "./types";

export async function uninstallCrewBee(options: UninstallOptions): Promise<UninstallResult> {
  const configPath = resolveOpenCodeConfigPath(options.configPath);
  const installRoot = resolveInstallRoot(options.installRoot);
  const configDocument = readOpenCodeConfig(configPath);
  const removal = removeCrewBeePluginEntries(configDocument.config);
  const configBackup = !options.dryRun && removal.changed
    ? backupOpenCodeConfig(configPath)
    : undefined;

  try {
    if (!options.dryRun && removal.changed) {
      writeOpenCodeConfig(configPath, configDocument.config);
    }

    const packageRemoved = uninstallCrewBeePackage({
      dryRun: options.dryRun,
      installRoot,
    });

    return {
      backupPath: configBackup?.backupPath,
      configChanged: removal.changed,
      configPath,
      dryRun: options.dryRun,
      installRoot,
      packageRemoved,
      removedEntries: removal.removedEntries,
    };
  } catch (error) {
    if (configBackup) {
      restoreOpenCodeConfigBackup(configBackup);
    }

    throw error;
  }
}
