import type {
  LoadedDocumentKind,
  LoadedProfileDocument,
  PromptProjectionSpec,
} from "../core";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = [...new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(present))];
  return normalized.length > 0 ? normalized : undefined;
}

function isSnakeCaseKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(key);
}

function isSnakeCasePath(key: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key);
}

function normalizeProjectionPathList(value: unknown, label: string): string[] | undefined {
  const normalized = normalizeStringArray(value);
  if (!normalized) {
    return undefined;
  }

  for (const path of normalized) {
    if (!isSnakeCasePath(path)) {
      throw new Error(`${label} only supports snake_case paths. Migrate '${path}' to snake_case.`);
    }
  }

  return normalized;
}

function isIdentifierKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(key);
}

export function assertSnakeCaseOnly(value: unknown, label: string = "document"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSnakeCaseOnly(entry, `${label}[${index}]`));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const allowsPathKeys = label.endsWith(".labels");
    const allowsIdentifierKeys = label.endsWith(".members") || label.endsWith(".agent_runtime");
    const isAllowed = allowsPathKeys
      ? isSnakeCasePath(key)
      : allowsIdentifierKeys
        ? isIdentifierKey(key)
        : isSnakeCaseKey(key);

    if (!isAllowed) {
      throw new Error(
        `${label} only supports snake_case keys. Migrate '${key}' to snake_case before loading the document.`,
      );
    }

    assertSnakeCaseOnly(entry, `${label}.${key}`);
  }
}

export function mapPromptProjection(value: unknown): PromptProjectionSpec | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const include = normalizeProjectionPathList(value.include, "prompt_projection.include");
  const exclude = normalizeProjectionPathList(value.exclude, "prompt_projection.exclude");
  const labels = isRecord(value.labels)
    ? Object.fromEntries(
        Object.entries(value.labels)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && present(entry[1].trim()))
          .map(([key, label]) => {
            if (!isSnakeCasePath(key.trim())) {
              throw new Error(`prompt_projection.labels only supports snake_case paths. Migrate '${key}' to snake_case.`);
            }

            return [key.trim(), label.trim()];
          }),
      )
    : undefined;

  if (!include && !exclude && (!labels || Object.keys(labels).length === 0)) {
    return undefined;
  }

  return {
    ...(include ? { include } : {}),
    ...(exclude ? { exclude } : {}),
    ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
  };
}

const TEAM_METADATA_KEYS = new Set(["id", "name", "kind", "version", "tags"]);
const AGENT_METADATA_KEYS = new Set(["id", "name", "kind", "version", "status", "owner", "tags", "archetype"]);
const CONTROL_KEYS = new Set(["prompt_projection"]);

export function loadProfileDocument(raw: UnknownRecord, kind: LoadedDocumentKind): LoadedProfileDocument {
  assertSnakeCaseOnly(raw, kind);

  const metadataKeys = kind === "agent" ? AGENT_METADATA_KEYS : TEAM_METADATA_KEYS;
  const metadata: Record<string, unknown> = {};
  const content: Record<string, unknown> = {};
  const sourceOrder: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (metadataKeys.has(key)) {
      metadata[key] = value;
      continue;
    }

    if (CONTROL_KEYS.has(key)) {
      continue;
    }

    content[key] = value;
    sourceOrder.push(key);
  }

  return {
    kind,
    metadata,
    content,
    promptProjection: mapPromptProjection(raw.prompt_projection),
    sourceOrder,
  };
}
