import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface WorkspaceBootstrapResult {
  created: boolean;
  packageJsonPath: string;
  workspaceRoot: string;
}

function createWorkspaceManifest() {
  return {
    name: "opencode-plugin-workspace",
    private: true,
    version: "0.0.0",
  };
}

export function ensureInstallWorkspace(workspaceRoot: string, dryRun: boolean): WorkspaceBootstrapResult {
  const packageJsonPath = path.join(workspaceRoot, "package.json");

  if (existsSync(packageJsonPath)) {
    const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error(`Workspace package manifest must be a JSON object: ${packageJsonPath}`);
    }

    return {
      created: false,
      packageJsonPath,
      workspaceRoot,
    };
  }

  if (!dryRun) {
    mkdirSync(workspaceRoot, { recursive: true });
    writeFileSync(packageJsonPath, `${JSON.stringify(createWorkspaceManifest(), null, 2)}\n`, "utf8");
  }

  return {
    created: true,
    packageJsonPath,
    workspaceRoot,
  };
}
