/**
 * TODO: Flip to `true` after Builtins Integrations/Apps rows are re-synced
 * with normalized `labels` metadata. Until then, the gallery keeps query,
 * source-type, and status filtering only.
 */
export const ENABLE_INTEGRATION_LABEL_FILTER = false;

export function effectiveSemanticCategory(semanticCategory: string): string | null {
  if (!ENABLE_INTEGRATION_LABEL_FILTER) return null;
  return semanticCategory === 'all' ? null : semanticCategory;
}

export function semanticCategoryFilterActive(semanticCategory: string): boolean {
  return ENABLE_INTEGRATION_LABEL_FILTER && semanticCategory !== 'all';
}
