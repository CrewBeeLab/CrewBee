import type { PromptCatalog, PromptNode, PromptProjectionSpec } from "../core";

export function matchesPath(selected: string, path: string): boolean {
  return selected === path || path.startsWith(`${selected}.`);
}

export function isAncestorPath(ancestor: string, descendant: string): boolean {
  return descendant === ancestor || descendant.startsWith(`${ancestor}.`);
}

export function projectNode(node: PromptNode, projection: PromptProjectionSpec | undefined): PromptNode | undefined {
  const include = projection?.include ?? [];
  const exclude = projection?.exclude ?? [];
  const labels = projection?.labels ?? {};

  const projectedChildren = node.children
    ?.map((child) => projectNode(child, projection))
    .filter((child): child is PromptNode => Boolean(child));

  const explicitlyIncluded = include.length === 0 || include.some((selected) => matchesPath(selected, node.path));
  const descendantIncluded = include.length > 0 && include.some((selected) => isAncestorPath(node.path, selected));
  const explicitlyExcluded = exclude.some((selected) => matchesPath(selected, node.path));

  const shouldKeep =
    include.length === 0
      ? (!explicitlyExcluded && (node.visibleByDefault || (projectedChildren?.length ?? 0) > 0))
      : ((explicitlyIncluded || descendantIncluded || (projectedChildren?.length ?? 0) > 0) && !explicitlyExcluded);

  if (!shouldKeep) {
    return undefined;
  }

  return {
    ...node,
    label: labels[node.path] ?? node.label,
    ...(projectedChildren ? { children: projectedChildren } : {}),
  };
}

export function applyPromptProjection(
  catalog: PromptCatalog,
  projection: PromptProjectionSpec | undefined,
): PromptCatalog {
  return {
    kind: catalog.kind,
    nodes: catalog.nodes
      .map((node) => projectNode(node, projection))
      .filter((node): node is PromptNode => Boolean(node)),
  };
}
