import type { LoadedProfileDocument, NormalizedProfileDocument, PromptValue } from "../core";

import { normalizeMarkdownSection, normalizeValue } from "./normalize-value";

function isPromptValueRecord(value: PromptValue | undefined): value is Record<string, PromptValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeProfileDocument(input: LoadedProfileDocument): NormalizedProfileDocument {
  const metadata = normalizeValue(input.metadata);
  if (!isPromptValueRecord(metadata)) {
    throw new Error(`${input.kind}.metadata is invalid.`);
  }

  const blocks: NormalizedProfileDocument["blocks"] = [];
  let order = 0;

  for (const key of input.sourceOrder) {
    const normalized = normalizeValue(input.content[key]);
    if (normalized === undefined) {
      continue;
    }

    blocks.push({
      key,
      path: key,
      value: normalized,
      order,
      source: "frontmatter",
    });
    order += 1;
  }

  for (const section of input.bodySections ?? []) {
    const normalized = normalizeMarkdownSection(section.rawMarkdown);
    if (normalized === undefined) {
      continue;
    }

    blocks.push({
      key: section.key,
      path: section.key,
      value: normalized,
      order,
      source: "body",
      title: section.title,
    });
    order += 1;
  }

  if (blocks.length === 0) {
    throw new Error(`${input.kind} document must contain at least one prompt content block.`);
  }

  return {
    kind: input.kind,
    metadata,
    blocks,
    promptProjection: input.promptProjection,
  };
}
