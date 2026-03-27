import type { PromptScalar, PromptValue } from "../core";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeScalar(value: unknown): PromptScalar | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

export function normalizeValue(value: unknown): PromptValue | undefined {
  const scalar = normalizeScalar(value);
  if (scalar !== undefined) {
    return scalar;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => normalizeValue(item))
      .filter((item): item is PromptValue => item !== undefined);

    if (items.length === 0) {
      return undefined;
    }

    if (items.every((item): item is string => typeof item === "string")) {
      return [...new Set(items)];
    }

    return items;
  }

  if (isRecord(value)) {
    const entries: Array<[string, PromptValue]> = [];

    for (const [key, raw] of Object.entries(value)) {
      const normalized = normalizeValue(raw);
      if (normalized !== undefined) {
        entries.push([key, normalized]);
      }
    }

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
}

export function normalizeMarkdownSection(markdown: string): PromptValue | undefined {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return undefined;
  }

  const bullets = lines.filter((line) => line.startsWith("- "));
  if (bullets.length === lines.length) {
    const items = bullets.map((line) => line.slice(2).trim()).filter((line) => line.length > 0);
    return items.length > 0 ? [...new Set(items)] : undefined;
  }

  return lines.join("\n").trim() || undefined;
}
