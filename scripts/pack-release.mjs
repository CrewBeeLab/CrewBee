import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = process.cwd();
const outputDir = path.join(packageRoot, ".artifacts", "release");

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
  console.error(`\nNo CrewBee release tarball was generated in ${outputDir}`);
  process.exit(1);
}

console.log(`\nRelease CrewBee package written to ${path.join(outputDir, generatedTarballName)}`);
