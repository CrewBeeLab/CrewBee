// Compatibility boundary: new install code should import package side effects from
// package-installation.ts, which names the module after its actual responsibility.
export {
  cleanupLegacyCrewBeePackage,
  installLocalTarball,
  installRegistryPackage,
  uninstallCrewBeePackage,
} from "./package-installation";
