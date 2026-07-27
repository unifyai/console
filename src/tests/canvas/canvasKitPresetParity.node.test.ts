import { describe, expect, it } from 'vitest';

/**
 * Guards the one deliberate duplication in the Canvas theming story.
 *
 * `@unity/brand/tailwind-preset` is shared, but a handful of scales the kit
 * needs — the display font, the `xl`/`pill` radii, the pop shadows, `card-2`,
 * `accent-soft` and the primary tints — live in console's own
 * `tailwind.config.ts`. Moving them would mean editing a live surface, so the
 * kit's preset restates them and this test is what keeps the two honest.
 *
 * It compares every key the two configs share. Adding a token to console alone
 * is fine; changing what an existing shared token resolves to is what would
 * silently make a canvas stop matching the app around it, and that fails here.
 *
 * Consolidating both onto one preset retires this test.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const kitPreset = require('@unity/canvas-kit/tailwind-preset');
const consoleConfig = require('../../../tailwind.config.ts');

type Scale = Record<string, unknown>;

const kitExtend = (kitPreset.theme?.extend ?? {}) as Record<string, Scale>;
const consoleExtend = (consoleConfig.theme?.extend ?? {}) as Record<string, Scale>;

/** Flatten a nested Tailwind scale to `dotted.path -> value`. */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object') return { [prefix]: String(value) };
  if (Array.isArray(value)) return { [prefix]: value.join(', ') };

  const out: Record<string, string> = {};
  for (const [key, nested] of Object.entries(value as Scale)) {
    Object.assign(out, flatten(nested, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** Scales where both configs define entries and the values must agree. */
const SHARED_SCALES = ['colors', 'borderRadius', 'boxShadow', 'fontFamily'] as const;

describe('canvas-kit preset parity with console', () => {
  it.each(SHARED_SCALES)('resolves every shared %s token to the same value', (scale) => {
    const kit = flatten(kitExtend[scale]);
    const consoleScale = flatten(consoleExtend[scale]);

    const shared = Object.keys(kit).filter((key) => key in consoleScale);
    // A rename on either side would empty this and quietly stop testing
    // anything, so require the overlap to exist.
    expect(shared.length).toBeGreaterThan(0);

    const divergent = shared
      .filter((key) => kit[key] !== consoleScale[key])
      .map((key) => `${scale}.${key}: kit=${kit[key]} console=${consoleScale[key]}`);

    expect(divergent).toEqual([]);
  });

  it('drives every kit colour through a CSS variable, never a literal', () => {
    const literals = Object.entries(flatten(kitExtend.colors))
      .filter(([, value]) => !value.includes('var(--'))
      .map(([key, value]) => `${key}: ${value}`);

    // A literal here would survive the author-time lint and the host's
    // colourless safelist, and would then be wrong in one of the two themes.
    expect(literals).toEqual([]);
  });

  it('builds on the shared brand preset rather than redefining it', () => {
    const presets = (kitPreset.presets ?? []) as Array<Record<string, unknown>>;
    expect(presets.length).toBe(1);

    const brandColors = flatten(
      ((presets[0]?.theme as Record<string, Scale>)?.extend?.colors ?? {}) as Scale
    );
    // The semantic colours and chart series must come from the brand preset, so
    // the kit and console cannot drift on the tokens that matter most.
    for (const key of [
      'background',
      'foreground',
      'card.DEFAULT',
      'border',
      'chart.1',
      'chart.5',
    ]) {
      expect(brandColors[key]).toBeDefined();
    }
    expect(Object.keys(flatten(kitExtend.colors))).not.toContain('background');
  });
});
