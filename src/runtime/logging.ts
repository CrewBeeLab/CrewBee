export type CrewBeeLogLevel = "debug" | "info" | "warn" | "error";

export interface CrewBeeLogEvent {
  level?: CrewBeeLogLevel;
  message: string;
  extra?: Record<string, unknown>;
}

export function isCrewBeeLoggingEnabled(): boolean {
  const raw = process.env.CREWBEE_LOG?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on" || raw === "debug";
}

export function shouldEmitCrewBeeLog(level: CrewBeeLogLevel = "info"): boolean {
  return level === "error" || level === "warn" || isCrewBeeLoggingEnabled();
}
