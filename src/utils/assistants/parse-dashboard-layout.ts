/**
 * Parse dashboard layout JSON from Orchestra / Droid (Dashboards/Layouts).
 *
 * Droid serializes TilePosition with snake_case keys (`tile_token`, etc.) via
 * Pydantic model_dump(). Client code must not assume `tileToken` without
 * transforming keys — raw JSON.parse leaves `tile_token` and breaks
 * `pos.tileToken`, which becomes `undefined` in URLs and filter expressions.
 */

import { snakeToCamelObject } from '@/utils/casing';
import type { DashboardTilePosition } from '@/types/assistants/dashboard';

function unwrapLayoutJson(layout: unknown): unknown[] {
  if (Array.isArray(layout)) return layout;
  if (typeof layout !== 'string' || !layout.trim()) return [];
  try {
    const once = JSON.parse(layout) as unknown;
    if (typeof once === 'string') {
      try {
        const twice = JSON.parse(once) as unknown;
        return Array.isArray(twice) ? twice : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(once) ? once : [];
  } catch {
    return [];
  }
}

/**
 * Normalize one layout cell after optional snake_case → camelCase keys.
 */
function normalizeCell(item: unknown): DashboardTilePosition | null {
  if (!item || typeof item !== 'object') return null;
  const o = snakeToCamelObject<Record<string, unknown>>(item);
  const raw = o.tileToken ?? o.token;
  const tileToken = typeof raw === 'string' && raw.length > 0 && raw !== 'undefined' ? raw : null;
  if (!tileToken) return null;

  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || fallback;

  return {
    tileToken,
    x: num(o.x, 0),
    y: num(o.y, 0),
    w: num(o.w, 6),
    h: num(o.h, 4),
  };
}

/** Parsed layout array from the string stored on dashboard records. */
export function parseDashboardLayout(layoutJson: string): DashboardTilePosition[] {
  return unwrapLayoutJson(layoutJson)
    .map(normalizeCell)
    .filter((p): p is DashboardTilePosition => p !== null);
}

/** Same normalization for an already-parsed value (e.g. after JSON.parse). */
export function normalizeDashboardTilePositions(input: unknown): DashboardTilePosition[] {
  return unwrapLayoutJson(input)
    .map(normalizeCell)
    .filter((p): p is DashboardTilePosition => p !== null);
}
