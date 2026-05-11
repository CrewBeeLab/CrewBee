import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = process.cwd();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    shell: process.platform === "win32",
    stdio: options.stdio ?? "inherit",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? 1}`);
  }

  return result;
}

function findTarballFromArgs() {
  const explicit = process.argv[2];
  if (explicit) {
    return { tarballPath: path.resolve(explicit), generated: false };
  }

  const result = run("npm", ["pack", "--silent"], { stdio: "pipe" });
  const tarballName = result.stdout.trim().split(/\r?\n/).at(-1);
  if (!tarballName) {
    throw new Error("npm pack did not report a tarball name");
  }

  return { tarballPath: path.join(packageRoot, tarballName), generated: true };
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "crewbee-package-smoke-"));
let generatedTarballPath;

try {
  const { tarballPath, generated } = findTarballFromArgs();
  if (generated) {
    generatedTarballPath = tarballPath;
  }
  const appRoot = path.join(tempRoot, "app");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify({ type: "module" }, null, 2)}\n`, "utf8");
  run("npm", ["install", "--silent", tarballPath], { cwd: tempRoot });

  const packageRoot = path.join(tempRoot, "node_modules", "crewbee");
  const pluginEntry = path.join(packageRoot, "dist", "opencode-plugin.mjs");
  let providersCalledWithReceiver = false;
  const configApi = {
    providerPayload: {
      providers: [
        {
          id: "openai",
          models: {
            "gpt-5.4-mini": { id: "gpt-5.4-mini", name: "gpt-5.4-mini" },
          },
        },
      ],
    },
    async providers() {
      providersCalledWithReceiver = this === configApi;
      return this.providerPayload;
    },
  };

  const mod = await import(pathToFileURL(pluginEntry).href);
  const plugin = await mod.default({
    client: {
      app: { log: async () => {} },
      config: configApi,
    },
    project: {
      id: "package-smoke",
      directory: appRoot,
      worktree: appRoot,
    },
    directory: appRoot,
    worktree: appRoot,
    $() {
      throw new Error("shell unavailable during package smoke");
    },
  });
  const config = { agent: {} };

  await plugin.config?.(config);

  if (!providersCalledWithReceiver) {
    throw new Error("OpenCode provider registry was not called with its SDK receiver binding");
  }

  if (!plugin.tool?.task) {
    throw new Error("CrewBee task tool is missing from the packaged plugin");
  }

  if (plugin.tool.delegate_task !== undefined) {
    throw new Error("Packaged plugin unexpectedly exposes legacy delegate_task");
  }

  if (config.agent["coding-codebase-explorer"]?.model !== "openai/gpt-5.4-mini") {
    throw new Error("Packaged plugin did not apply provider model availability during config projection");
  }

  console.log("CrewBee packed package smoke passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  if (generatedTarballPath) {
    rmSync(generatedTarballPath, { force: true });
  }
}
