import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node ./scripts/set-version.mjs <semver>");
  process.exit(1);
}

const root = process.cwd();
const files = ["package.json", "package-lock.json"];

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));

  parsed.version = version;

  if (relativePath === "package-lock.json" && parsed.packages?.[""]) {
    parsed.packages[""].version = version;
  }

  writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

console.log(`Updated package version to ${version}`);
