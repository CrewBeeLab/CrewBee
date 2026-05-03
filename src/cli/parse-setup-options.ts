import type { SetupOptions } from "../install";

function getOptionValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }

  return value;
}

function parseChannel(value: string): "stable" | "next" {
  if (value !== "stable" && value !== "next") {
    throw new Error(`Unsupported setup channel '${value}'.`);
  }

  return value;
}

export function parseSetupOptions(argv: string[]): SetupOptions {
  let channel: "stable" | "next" = "stable";
  let configPath: string | undefined;
  let doctor = true;
  let dryRun = false;
  let force = false;
  let installRoot: string | undefined;
  let verbose = false;
  let withOpenCode = false;
  let yes = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--with-opencode") {
      withOpenCode = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      yes = true;
      continue;
    }

    if (arg === "--doctor") {
      doctor = true;
      continue;
    }

    if (arg === "--no-doctor") {
      doctor = false;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--channel") {
      channel = parseChannel(getOptionValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--channel=")) {
      channel = parseChannel(arg.slice("--channel=".length));
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

    throw new Error(`Unknown setup option '${arg}'.`);
  }

  return {
    channel,
    configPath,
    doctor,
    dryRun,
    force,
    installRoot,
    verbose,
    withOpenCode,
    yes,
  };
}
