import type { Plugin } from "@opencode/plugin";

interface ModelLike {
  providerID?: unknown;
  id?: unknown;
  modelID?: unknown;
  enabled?: unknown;
}

function readModelKey(model: ModelLike): string | undefined {
  if (model.enabled === false) {
    return undefined;
  }

  const providerID = typeof model.providerID === "string" ? model.providerID : undefined;
  const modelID = typeof model.id === "string"
    ? model.id
    : (typeof model.modelID === "string" ? model.modelID : undefined);

  if (!providerID || !modelID) {
    return undefined;
  }

  return `${providerID}/${modelID}`;
}

/**
 * V2 replacement for `client.config.providers()`.
 *
 * Returns `undefined` when the host registry cannot be read, so that CrewBee keeps the host
 * default model instead of assuming its built-in recommendations are usable.
 */
export async function listOpenCodeAvailableModelsV2(ctx: Plugin.Context): Promise<string[] | undefined> {
  try {
    const output = await ctx.model.list();
    const models = (output as unknown as { data?: readonly ModelLike[] }).data ?? [];
    const keys = new Set<string>();

    for (const model of models) {
      const key = readModelKey(model);
      if (key) {
        keys.add(key);
      }
    }

    return [...keys].sort();
  } catch {
    return undefined;
  }
}
