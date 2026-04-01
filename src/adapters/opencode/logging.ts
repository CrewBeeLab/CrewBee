import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { shouldEmitCrewBeeLog, type CrewBeeLogLevel } from "../../runtime/logging";

export async function logCrewBee(
  ctx: PluginInput | Parameters<Plugin>[0],
  message: string,
  extra?: Record<string, unknown>,
  level: CrewBeeLogLevel = "info",
): Promise<void> {
  if (!shouldEmitCrewBeeLog(level)) {
    return;
  }

  await ctx.client.app.log({
    body: {
      service: "crewbee",
      level,
      message,
      extra,
    },
  });
}
