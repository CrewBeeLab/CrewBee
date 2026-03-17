import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = process.cwd();
const outputDir = path.join(packageRoot, ".artifacts", "local");
const stableTarballPath = path.join(outputDir, "crewbee-local.tgz");

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const result = spawnSync("npm", ["pack", "--pack-destination", outputDir], {
  cwd: packageRoot,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const generatedTarballName = readdirSync(outputDir).find((entry) => /^crewbee-.*\.tgz$/i.test(entry));

if (!generatedTarballName) {
  console.error(`\nNo CrewBee tarball was generated in ${outputDir}`);
  process.exit(1);
}

const generatedTarballPath = path.join(outputDir, generatedTarballName);

if (generatedTarballPath !== stableTarballPath) {
  renameSync(generatedTarballPath, stableTarballPath);
}

console.log(`\nLocal CrewBee package written to ${stableTarballPath}`);
