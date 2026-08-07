import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Every drawer inside the assistants tabs is the same width.
 *
 * They were not: Functions opened at 42rem, Workflows at 640px,
 * Integrations at 960px, and the rest fell through to the variant default,
 * so moving between tabs resized the panel for no reason a user could see.
 * The width now lives once in the sheet primitive, and this pins the thing
 * that made them diverge — a drawer setting its own.
 *
 * A source read rather than a render: the width is a class on a portalled
 * Radix node, and asserting on computed layout in jsdom would test jsdom.
 * What actually regresses is someone adding `w-[…]` back to one drawer.
 */
const ROOT = path.resolve(__dirname, '../../..');

const DRAWERS = [
  'src/components/Pages/Assistants/DocLibrary/DocAddDrawer.tsx',
  'src/components/Pages/Assistants/Contacts/ContactsPane.tsx',
  'src/components/Pages/Assistants/Data/DataRowDetail.tsx',
  'src/components/Pages/Assistants/Tasks/NewTaskDrawer.tsx',
  'src/components/Pages/Assistants/Functions/FunctionsPane.tsx',
  'src/components/Workflows/WorkflowDetailSheet.tsx',
  'src/components/Integrations/ProviderIntegrationDetailSheet.tsx',
];

/** The className string on each `SheetContent` in a file. */
function sheetContentClassNames(source: string): string[] {
  const found: string[] = [];
  const openings = source.matchAll(/<SheetContent\b/g);
  for (const opening of openings) {
    const start = opening.index ?? 0;
    const end = source.indexOf('>', start);
    const tag = source.slice(start, end === -1 ? source.length : end);
    for (const match of tag.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      found.push(match[1] ?? match[2] ?? '');
    }
  }
  return found;
}

describe('assistant drawer width', () => {
  it('is declared once, in the sheet primitive', () => {
    const sheet = readFileSync(path.join(ROOT, 'src/components/UI/sheet.tsx'), 'utf8');
    expect(sheet).toContain("'w-[min(96vw,max(40vw,26rem))] sm:max-w-[min(96vw,max(40vw,26rem))]'");
    // The `right` variant is what every drawer opens as, so the shared
    // width has to be in it rather than merely exported beside it.
    expect(sheet).toMatch(/right: `inset-y-0 right-0 h-full \$\{DRAWER_WIDTH_CLASS\}/);
  });

  it.each(DRAWERS)('%s sets no width of its own', (file) => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    const classNames = sheetContentClassNames(source);
    expect(classNames.length).toBeGreaterThan(0);
    for (const className of classNames) {
      expect(className).not.toMatch(/(^|\s|!)(sm:)?w-/);
      expect(className).not.toMatch(/(^|\s|!)(sm:)?max-w-/);
    }
  });
});
