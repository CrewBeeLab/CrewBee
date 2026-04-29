import type { LoadedProfileDocument, NormalizedProfileDocument } from "../core";
import { buildPromptCatalog } from "../catalog/build-prompt-catalog";
import { normalizeProfileDocument } from "../normalize/normalize-document";
import { buildPromptPlan } from "../plan/build-prompt-plan";
import { applyPromptProjection } from "../projection/apply-prompt-projection";

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
