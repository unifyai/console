/** Responsive grid for the Functions tab — keep in sync with origin/staging. */
export const FUNCTIONS_GRID_CLASS =
  'box-border grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-4 p-4';

/** Read the live auto-fill column count from the approved grid class. */
export function readAutoFillGridColumnCount(gridElement: HTMLElement): number {
  const template = window.getComputedStyle(gridElement).gridTemplateColumns;
  if (!template || template === 'none') return 1;
  return template.split(' ').filter(Boolean).length;
}
