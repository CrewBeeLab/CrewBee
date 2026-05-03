import type { InstallCommandOptions, InstallSource } from "../install";

function getOptionValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }

  return value;
}

export function parseInstallOptions(argv: string[]): InstallCommandOptions {
  let channel: "stable" | "next" = "stable";
  let configPath: string | undefined;
  let dryRun = false;
  let force = false;
  let installRoot: string | undefined;
  let localTarballPath: string | undefined;
  let source: InstallSource = "local";
  let yes = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      yes = true;
      continue;
    }

    if (arg === "--channel") {
      const value = getOptionValue(argv, index, arg);
      if (value !== "stable" && value !== "next") {
        throw new Error(`Unsupported install channel '${value}'.`);
      }
      channel = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--channel=")) {
      const value = arg.slice("--channel=".length);
      if (value !== "stable" && value !== "next") {
        throw new Error(`Unsupported install channel '${value}'.`);
      }
      channel = value;
      continue;
    }

    if (arg === "--config-path" || arg === "--config") {
      configPath = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--config-path=")) {
      configPath = arg.slice("--config-path=".length);
      continue;
    }

    if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--install-root") {
      installRoot = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--install-root=")) {
      installRoot = arg.slice("--install-root=".length);
      continue;
    }

    if (arg === "--local-tarball" || arg === "--tarball") {
      localTarballPath = getOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--local-tarball=")) {
      localTarballPath = arg.slice("--local-tarball=".length);
      continue;
    }

    if (arg.startsWith("--tarball=")) {
      localTarballPath = arg.slice("--tarball=".length);
      continue;
    }

    if (arg === "--source") {
      const value = getOptionValue(argv, index, arg);

      if (value !== "local" && value !== "registry") {
        throw new Error(`Unsupported install source '${value}'.`);
      }

      source = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--source=")) {
      const value = arg.slice("--source=".length);

      if (value !== "local" && value !== "registry") {
        throw new Error(`Unsupported install source '${value}'.`);
      }

      source = value;
      continue;
    }

    throw new Error(`Unknown install option '${arg}'.`);
  }

  return {
    channel,
    configPath,
    dryRun,
    force,
    installRoot,
    localTarballPath,
    source,
    yes,
  };
}
