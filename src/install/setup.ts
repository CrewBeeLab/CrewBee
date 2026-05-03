import { installCrewBee } from "./install";
import { detectOpenCodeCli, installOpenCodeCli } from "./opencode-cli";
import { runDoctor } from "./doctor";
import type { InstallCommandContext, SetupOptions, SetupResult } from "./types";

export async function setupCrewBee(input: {
  context: InstallCommandContext;
  options: SetupOptions;
}): Promise<SetupResult> {
  let opencode = detectOpenCodeCli();
  let opencodeInstallAttempted = false;
  let opencodeInstallCommand: string | undefined;

  if (!opencode.found) {
    if (!input.options.withOpenCode && !input.options.dryRun) {
      throw new Error([
        "OpenCode was not found in PATH.",
        "",
        "Run:",
        "  npx crewbee@latest setup --with-opencode",
        "",
        "Or install OpenCode manually, then re-run:",
        "  npx crewbee@latest setup",
      ].join("\n"));
    }

    if (input.options.withOpenCode) {
      opencodeInstallAttempted = true;
      const installResult = installOpenCodeCli({ dryRun: input.options.dryRun });
      opencodeInstallCommand = installResult.command;

      if (installResult.installed) {
        opencode = detectOpenCodeCli();
        if (!opencode.found) {
          throw new Error([
            "OpenCode install completed, but `opencode` is still not available in PATH.",
            "",
            "Open a new terminal, verify `opencode --version`, then re-run:",
            "  npx crewbee@latest setup",
          ].join("\n"));
        }
      }
    }
  }

  const installResult = await installCrewBee({
    context: input.context,
    options: {
      channel: input.options.channel,
      configPath: input.options.configPath,
      dryRun: input.options.dryRun,
      force: input.options.force,
      installRoot: input.options.installRoot,
      source: "registry",
      yes: input.options.yes,
    },
  });

  const shouldRunDoctor = input.options.doctor && !input.options.dryRun;
  const doctorResult = shouldRunDoctor
    ? await runDoctor({
      configPath: input.options.configPath,
      installRoot: input.options.installRoot,
    })
    : undefined;

  return {
    doctorResult,
    doctorRun: shouldRunDoctor,
    dryRun: input.options.dryRun,
    installResult,
    opencodeFound: opencode.found,
    opencodeInstallAttempted,
    opencodeInstallCommand,
    opencodePath: opencode.path,
    opencodeVersion: opencode.version,
    withOpenCode: input.options.withOpenCode,
  };
}
