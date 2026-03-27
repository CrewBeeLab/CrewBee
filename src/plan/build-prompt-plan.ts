import type { PromptCatalog, PromptPlan } from "../core";

export function buildPromptPlan(catalog: PromptCatalog): PromptPlan {
  return {
    sections: [...catalog.nodes]
      .sort((left, right) => left.order - right.order)
      .map((node, index) => ({
        path: node.path,
        title: node.label,
        order: index,
        node,
      })),
  };
}
