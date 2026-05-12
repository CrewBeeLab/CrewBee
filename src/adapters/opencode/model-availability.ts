import { unwrapSdkResponse } from "./delegation/sdk-response";

interface ProviderLike {
  id?: unknown;
  models?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProviders(value: unknown): ProviderLike[] | undefined {
  const unwrapped = unwrapSdkResponse(value);
  if (!isRecord(unwrapped) || !Array.isArray(unwrapped.providers)) {
    return undefined;
  }

  return unwrapped.providers as ProviderLike[];
}

export async function listOpenCodeAvailableModels(input: {
  client: unknown;
}): Promise<string[] | undefined> {
  if (!isRecord(input.client) || !isRecord(input.client.config) || typeof input.client.config.providers !== "function") {
    return undefined;
  }

  const providers = input.client.config.providers as () => Promise<unknown>;
  const response = await providers().catch(() => undefined);
  const providerList = getProviders(response);
  if (!providerList) {
    return undefined;
  }

  const models: string[] = [];
  for (const provider of providerList) {
    if (typeof provider.id !== "string" || !isRecord(provider.models)) {
      continue;
    }

    for (const modelID of Object.keys(provider.models)) {
      models.push(`${provider.id}/${modelID}`);
    }
  }

  return [...new Set(models)].sort();
}
