import { appendFileSync } from "node:fs";

import { shouldEmitCrewBeeLog, type CrewBeeLogLevel } from "../../../runtime/logging";

const CONSOLE_METHOD: Record<CrewBeeLogLevel, "debug" | "info" | "warn" | "error"> = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
};

function stringifyExtra(extra?: Record<string, unknown>): string {
  if (!extra || Object.keys(extra).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(extra)}`;
  } catch {
    return " [unserializable extra]";
  }
}

/**
 * OpenCode V2 no longer exposes `ctx.client.app.log`, and plugin `console` output is not captured
 * in the server log. Logging therefore goes to the plugin's own console stream and, optionally,
 * to a file when `CREWBEE_LOG_FILE` is set.
 */
export async function logCrewBeeV2(
  message: string,
  extra?: Record<string, unknown>,
  level: CrewBeeLogLevel = "info",
): Promise<void> {
  if (!shouldEmitCrewBeeLog(level)) {
    return;
  }

  const line = `[crewbee] ${message}${stringifyExtra(extra)}`;
  console[CONSOLE_METHOD[level] ?? "log"](line);

  const logFile = process.env.CREWBEE_LOG_FILE?.trim();
  if (!logFile) {
    return;
  }

  try {
    appendFileSync(logFile, `${new Date().toISOString()} level=${level} ${line}\n`);
  } catch {
    // Diagnostics must never break the plugin.
  }
}
