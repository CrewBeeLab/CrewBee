import type { LoadedBodySection, LoadedProfileDocument } from "../core";

function toSnakeCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function parseMarkdownBodySections(markdown: string): LoadedBodySection[] {
  const normalized = markdown.replace(/^\s+|\s+$/g, "");
  if (!normalized) {
    return [];
  }

  const matches = [...normalized.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [];
  }

  return matches
    .map((match, index) => {
      const title = match[1].trim();
      const start = match.index! + match[0].length;
      const end = matches[index + 1]?.index ?? normalized.length;

      return {
        key: toSnakeCase(title),
        title,
        rawMarkdown: normalized.slice(start, end).trim(),
        order: index,
      };
    })
    .filter((section) => section.key.length > 0 && section.rawMarkdown.length > 0);
}

export function attachMarkdownBodySections(
  document: LoadedProfileDocument,
  markdown: string,
): LoadedProfileDocument {
  const bodySections = parseMarkdownBodySections(markdown);
  const frontmatterKeys = new Set(document.sourceOrder);

  for (const section of bodySections) {
    if (frontmatterKeys.has(section.key)) {
      throw new Error(
        `${document.kind} markdown body section '${section.key}' conflicts with an existing frontmatter top-level key.`,
      );
    }
  }

  return {
    ...document,
    bodySections,
  };
}
