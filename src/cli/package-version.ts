import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function readPackageManifest(packageRoot: string): { name: string; version: string } {
  const manifestPath = path.join(packageRoot, "package.json");
  if (!existsSync(manifestPath)) {
    return {
      name: path.basename(packageRoot) || "crewbee",
      version: "unknown",
    };
  }

  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { name?: unknown; version?: unknown };
  return {
    name: typeof parsed.name === "string" ? parsed.name : "crewbee",
    version: typeof parsed.version === "string" ? parsed.version : "unknown",
  };
}

export function readPackageVersion(packageRoot: string): string {
  return readPackageManifest(packageRoot).version;
}

export function readPackageName(packageRoot: string): string {
  return readPackageManifest(packageRoot).name;
}
