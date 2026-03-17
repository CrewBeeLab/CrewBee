import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function resolveExplicitTarballPath(localTarballPath: string): string {
  const tarballPath = path.resolve(localTarballPath);

  if (!existsSync(tarballPath)) {
    throw new Error(`Local tarball not found at ${tarballPath}.`);
  }

  return tarballPath;
}

export function resolveLocalTarballPath(input: {
  localTarballPath?: string;
  searchRoots: string[];
}): string {
  if (input.localTarballPath) {
    return resolveExplicitTarballPath(input.localTarballPath);
  }

  const uniqueRoots = [...new Set(input.searchRoots.map((root) => path.resolve(root)))];
  const candidates: Array<{ path: string; mtimeMs: number }> = [];

  for (const root of uniqueRoots) {
    const localArtifactsRoot = path.join(root, ".artifacts", "local");
    const stableTarball = path.join(localArtifactsRoot, "crewbee-local.tgz");

    if (existsSync(stableTarball)) {
      return stableTarball;
    }

    if (!existsSync(localArtifactsRoot)) {
      continue;
    }

    for (const entry of readdirSync(localArtifactsRoot)) {
      if (!/^crewbee-.*\.tgz$/i.test(entry)) {
        continue;
      }

      const tarballPath = path.join(localArtifactsRoot, entry);
      candidates.push({
        path: tarballPath,
        mtimeMs: statSync(tarballPath).mtimeMs,
      });
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (candidates[0]) {
    return candidates[0].path;
  }

  throw new Error("No local CrewBee tarball was found. Run 'npm run pack:local' or pass --local-tarball.");
}
