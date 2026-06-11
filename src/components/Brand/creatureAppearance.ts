/**
 * Droid avatar sentinel — a compact, storage-free encoding of a droid's
 * appearance.
 *
 * A droid avatar is a deterministic SVG (`TeammateCreature`) fully described
 * by three small enums (shape × color × eyes). Rather than rasterize and store
 * an image per assistant, we persist the appearance inline in the existing
 * `profile_photo` field using a `appearance://<shape>/<color>/<eyes>` sentinel.
 *
 * This keeps a single code path: anything that renders an assistant photo checks
 * for the sentinel and either reconstructs the droid locally (no fetch, works
 * offline / self-host with zero storage) or, when the value is a real URL,
 * renders the image as before. The backend treats it as an opaque string and the
 * signed-URL machinery ignores it (it isn't a `gs://` path), so no server change
 * is required.
 */

import { creatureShapes, roleColorVars, type BrandRole, type CreatureShape } from './shapes';
import type { CreatureEyes } from './TeammateCreature';

export const APPEARANCE_SENTINEL_PREFIX = 'appearance://';

export interface CreatureAppearance {
  shape: CreatureShape;
  color: BrandRole;
  eyes: CreatureEyes;
}

export const DEFAULT_CREATURE_APPEARANCE: CreatureAppearance = {
  shape: 'clawd',
  color: 'green',
  eyes: 'up',
};

const VALID_SHAPES = new Set<string>(Object.keys(creatureShapes));
const VALID_COLORS = new Set<string>(Object.keys(roleColorVars));
const VALID_EYES = new Set<string>(['up', 'down', 'square']);

/** Whether a stored photo value encodes a droid appearance (vs. a real URL). */
export function isCreatureSentinel(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(APPEARANCE_SENTINEL_PREFIX);
}

/** Encode an appearance into the `appearance://shape/color/eyes` sentinel. */
export function buildCreatureSentinel(appearance: CreatureAppearance): string {
  return `${APPEARANCE_SENTINEL_PREFIX}${appearance.shape}/${appearance.color}/${appearance.eyes}`;
}

/**
 * Decode a sentinel back into an appearance, or return `null` when the value is
 * not a droid sentinel (e.g. a real photo URL). Unknown/garbled parts fall
 * back to the defaults so a malformed value still renders a sensible droid
 * rather than throwing.
 */
export function parseCreatureSentinel(value: string | null | undefined): CreatureAppearance | null {
  if (!isCreatureSentinel(value)) return null;
  const [shape, color, eyes] = value.slice(APPEARANCE_SENTINEL_PREFIX.length).split('/');
  return {
    shape: VALID_SHAPES.has(shape) ? (shape as CreatureShape) : DEFAULT_CREATURE_APPEARANCE.shape,
    color: VALID_COLORS.has(color) ? (color as BrandRole) : DEFAULT_CREATURE_APPEARANCE.color,
    eyes: VALID_EYES.has(eyes) ? (eyes as CreatureEyes) : DEFAULT_CREATURE_APPEARANCE.eyes,
  };
}
