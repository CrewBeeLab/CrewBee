export interface CommandPathOptions {
  configPath?: string;
  dryRun: boolean;
  installRoot?: string;
}

function getOptionValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }

  return value;
}

export function parseCommandPathOptions(argv: string[], allowDryRun: boolean): CommandPathOptions {
  let configPath: string | undefined;
  let dryRun = false;
  let installRoot: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (allowDryRun && arg === "--dry-run") {
      dryRun = true;
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

    throw new Error(`Unknown option '${arg}'.`);
  }

  return {
    configPath,
    dryRun,
    installRoot,
  };
}
