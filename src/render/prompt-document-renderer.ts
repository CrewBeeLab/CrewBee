import type { LoadedProfileDocument, NormalizedProfileDocument } from "../core";
import { normalizeProfileDocument } from "../normalize/normalize-document";

import { applyPromptProjection } from "./apply-prompt-projection";
import { buildPromptCatalog } from "./build-prompt-catalog";
import { buildPromptPlan } from "./build-prompt-plan";
import { defaultRenderContext, renderPromptPlan } from "./structural-renderer";

export function renderNormalizedPromptDocument(document: NormalizedProfileDocument): string {
  const catalog = buildPromptCatalog(document);
  const projectedCatalog = applyPromptProjection(catalog, document.promptProjection);
  const plan = buildPromptPlan(projectedCatalog);
  return renderPromptPlan(plan, defaultRenderContext);
}

export function renderLoadedPromptDocument(document: LoadedProfileDocument): string {
  return renderNormalizedPromptDocument(normalizeProfileDocument(document));
}
