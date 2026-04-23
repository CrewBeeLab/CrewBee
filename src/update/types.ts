export interface CrewBeeReleaseIntent {
  configPath: string;
  entry: string;
  packageName: string;
  requestedVersion: string;
  channel: string;
  isPinned: boolean;
  workspaceRoot: string;
}

export interface CrewBeeReleaseCheckResult {
  currentVersion?: string;
  latestVersion?: string;
  needsRefresh: boolean;
  reason:
    | "plugin-not-configured"
    | "pinned-version"
    | "latest-unavailable"
    | "up-to-date"
    | "refresh-required";
}

export interface CrewBeeReleaseRefreshDependencies {
  fetchJson(url: string): Promise<unknown>;
  runInstall(workspaceRoot: string): Promise<boolean>;
}
