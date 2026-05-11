import { readFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const packageRoot = process.cwd();
const packageJsonPath = path.join(packageRoot, "package.json");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readCurrentVersion() {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return parsed.version;
}

function bumpVersion(baseVersion, bump) {
  const stable = baseVersion.split("-")[0];
  const [major, minor, patch] = stable.split(".").map((value) => Number.parseInt(value, 10));

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function fetchRegistryLatestVersion() {
  return new Promise((resolve) => {
    https.get("https://registry.npmjs.org/crewbee/latest", (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
      });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          resolve(typeof parsed.version === "string" ? parsed.version : undefined);
        } catch {
          resolve(undefined);
        }
      });
    }).on("error", () => resolve(undefined));
  });
}

function resolveDistTag(version, explicitTag) {
  if (explicitTag) {
    return explicitTag;
  }

  const prerelease = version.match(/-([a-zA-Z][a-zA-Z0-9-]*)(?:\.|$)/);
  return prerelease ? prerelease[1] : "latest";
}

const args = parseArgs({
  options: {
    bump: { type: "string" },
    version: { type: "string" },
    tag: { type: "string" },
    publish: { type: "boolean" },
    dryRun: { type: "boolean" },
  },
  allowPositionals: false,
});

const bump = args.values.bump ?? "patch";

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Unsupported bump '${bump}'. Use patch, minor, or major.`);
  process.exit(1);
}

const currentVersion = readCurrentVersion();
const registryVersion = await fetchRegistryLatestVersion();
const nextVersion = args.values.version
  ?? bumpVersion(registryVersion ?? currentVersion, bump);
const distTag = resolveDistTag(nextVersion, args.values.tag);
const dryRun = Boolean(args.values.dryRun);
const shouldPublish = Boolean(args.values.publish) && !dryRun;

console.log(`Current version: ${currentVersion}`);
console.log(`Registry latest: ${registryVersion ?? "unavailable"}`);
console.log(`Next version: ${nextVersion}`);
console.log(`Dist tag: ${distTag}`);
console.log(`Publish mode: ${shouldPublish ? "npm publish" : "prepare only"}`);

run("node", ["./scripts/set-version.mjs", nextVersion]);
run("npm", ["run", "typecheck"]);
run("npm", ["run", "test"]);
run("npm", ["run", "doctor"]);
run("npm", ["run", "simulate:opencode"]);
run("npm", ["run", "simulate:compact"]);
run("npm", ["run", "pack:release"]);
run("npm", ["run", "smoke:package"]);

if (dryRun || !shouldPublish) {
  console.log("\nRelease preparation completed. No npm publish was performed.");
  console.log(`Next manual step: npm publish --access public --provenance --tag ${distTag}`);
  process.exit(0);
}

run("npm", ["publish", "--access", "public", "--provenance", "--tag", distTag]);
console.log(`\nPublished crewbee@${nextVersion} with dist-tag '${distTag}'.`);
