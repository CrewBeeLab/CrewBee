export function renderCliHelp(): string {
  return [
    "CrewBee CLI",
    "",
    "Usage:",
    "  crewbee install [--source <local|registry>] [--local-tarball <path>] [--install-root <path>] [--config-path <path>] [--dry-run]",
    "  crewbee install:local:user [--local-tarball <path>] [--install-root <path>] [--config-path <path>] [--dry-run]",
    "  crewbee install:registry:user [--install-root <path>] [--config-path <path>] [--dry-run]",
    "  crewbee uninstall:user [--install-root <path>] [--config-path <path>] [--dry-run]",
    "  crewbee doctor [--install-root <path>] [--config-path <path>]",
    "  crewbee version [--install-root <path>] [--json]",
    "  crewbee help",
    "",
    "Current scope:",
    "  local      Install CrewBee into the OpenCode user-level workspace from a local tarball.",
    "  registry   Install CrewBee into the OpenCode user-level workspace from the published npm package.",
    "",
    "Compatibility aliases:",
    "  --tarball      Deprecated alias for --local-tarball",
    "  --config       Deprecated alias for --config-path",
  ].join("\n");
}
