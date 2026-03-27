import type { PromptNode, PromptPlan, PromptPlanSection, PromptScalar, PromptValue } from "../core";

export interface StructuralRenderContext {
  indentUnit: string;
}

export const defaultRenderContext: StructuralRenderContext = {
  indentUnit: "  ",
};

export function formatScalar(value: PromptScalar): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export function indentLines(
  lines: readonly string[],
  depth: number,
  ctx: StructuralRenderContext,
): string[] {
  const prefix = ctx.indentUnit.repeat(depth);
  return lines.map((line) => `${prefix}${line}`);
}

function renderRawValue(
  label: string | undefined,
  value: PromptValue,
  depth: number,
  ctx: StructuralRenderContext,
): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return label
      ? indentLines([`- ${label}: ${formatScalar(value)}`], depth, ctx)
      : indentLines([`- ${formatScalar(value)}`], depth, ctx);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }

    const isScalarList = value.every(
      (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
    );

    if (isScalarList) {
      return label
        ? [
            ...indentLines([`- ${label}:`], depth, ctx),
            ...indentLines(value.map((item) => `- ${formatScalar(item as PromptScalar)}`), depth + 1, ctx),
          ]
        : indentLines(value.map((item) => `- ${formatScalar(item as PromptScalar)}`), depth, ctx);
    }

    const isObjectList = value.every((item) => item && typeof item === "object" && !Array.isArray(item));
    if (isObjectList) {
      const lines: string[] = [];
      if (label) {
        lines.push(...indentLines([`- ${label}:`], depth, ctx));
      }

      for (const item of value) {
        lines.push(...renderRawValue(undefined, item, label ? depth + 1 : depth, ctx));
      }

      return lines;
    }

    const lines: string[] = [];
    if (label) {
      lines.push(...indentLines([`- ${label}:`], depth, ctx));
    }

    value.forEach((item, index) => {
      lines.push(...renderRawValue(label ? `Item ${index + 1}` : undefined, item, label ? depth + 1 : depth, ctx));
    });

    return lines;
  }

  const entries = Object.entries(value as Record<string, PromptValue>);
  if (entries.length === 0) {
    return [];
  }

  const lines: string[] = [];
  if (label) {
    lines.push(...indentLines([`- ${label}:`], depth, ctx));
  }

  for (const [key, child] of entries) {
    const childLabel = key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    lines.push(...renderRawValue(childLabel, child, label ? depth + 1 : depth, ctx));
  }

  return lines;
}

function renderNode(node: PromptNode, depth: number, ctx: StructuralRenderContext, isSectionRoot: boolean): string[] {
  if (node.kind === "object") {
    const children = [...(node.children ?? [])].sort((left, right) => left.order - right.order);

    if (children.length === 0) {
      return [];
    }

    const lines: string[] = [];
    const childDepth = isSectionRoot ? depth : depth + 1;

    if (!isSectionRoot) {
      lines.push(...indentLines([`- ${node.label}:`], depth, ctx));
    }

    for (const child of children) {
      lines.push(...renderNode(child, childDepth, ctx, false));
    }

    return lines;
  }

  if (node.kind === "array") {
    return renderRawValue(isSectionRoot ? undefined : node.label, node.value, depth, ctx);
  }

  if (typeof node.value === "string" || typeof node.value === "number" || typeof node.value === "boolean") {
    return isSectionRoot
      ? indentLines([`- ${formatScalar(node.value)}`], depth, ctx)
      : indentLines([`- ${node.label}: ${formatScalar(node.value)}`], depth, ctx);
  }

  return [];
}

export function renderSection(
  section: PromptPlanSection,
  ctx: StructuralRenderContext = defaultRenderContext,
): string | undefined {
  const body = renderNode(section.node, 0, ctx, true);
  return body.length > 0 ? [`### ${section.title}`, ...body].join("\n") : undefined;
}

export function renderPromptPlan(
  plan: PromptPlan,
  ctx: StructuralRenderContext = defaultRenderContext,
): string {
  return plan.sections
    .map((section) => renderSection(section, ctx))
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}
