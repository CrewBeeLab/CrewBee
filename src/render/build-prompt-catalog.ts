import type { NormalizedProfileDocument, PromptCatalog, PromptNode, PromptNodeKind, PromptValue } from "../core";

function isPromptValueRecord(value: PromptValue): value is Record<string, PromptValue> {
  return typeof value === "object" && !Array.isArray(value);
}

export function formatDisplayLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function toTitleLabel(key: string): string {
  return formatDisplayLabel(key);
}

export function detectNodeKind(value: PromptValue): PromptNodeKind {
  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "object") {
    return "object";
  }

  return "scalar";
}

export function buildNode(path: string, key: string, value: PromptValue, order: number): PromptNode {
  const kind = detectNodeKind(value);

  if (kind !== "object") {
    return {
      path,
      key,
      label: toTitleLabel(key),
      kind,
      value,
      order,
      visibleByDefault: true,
    };
  }

  const children = Object.entries(value as Record<string, PromptValue>).map(([childKey, childValue], index) =>
    buildNode(`${path}.${childKey}`, childKey, childValue, index),
  );

  return {
    path,
    key,
    label: toTitleLabel(key),
    kind,
    value,
    children,
    order,
    visibleByDefault: true,
  };
}

function applyMetadataVisibility(node: PromptNode): PromptNode {
  if (node.path !== "metadata" || !node.children) {
    return node;
  }

  const visiblePaths = new Set(["metadata.id", "metadata.name", "metadata.archetype"]);

  return {
    ...node,
    visibleByDefault: false,
    children: node.children.map((child) => ({
      ...child,
      visibleByDefault: visiblePaths.has(child.path),
    })),
  };
}

export function buildPromptCatalog(doc: NormalizedProfileDocument): PromptCatalog {
  const metadataNode = applyMetadataVisibility(buildNode("metadata", "metadata", doc.metadata, -1));
  const nodes = [metadataNode];

  for (const block of doc.blocks) {
    const node = buildNode(block.path, block.key, block.value, block.order);
    nodes.push({
      ...node,
      label: block.title ?? node.label,
    });
  }

  return {
    kind: doc.kind,
    nodes,
  };
}
