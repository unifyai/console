/**
 * Canonical initials-avatar palette for people and workspace identities.
 *
 * Order matches `.design/Platform Redesign/app/brain.jsx` (`PALETTE` / `colorFor`):
 * green → coral → amber → cyan → purple → teal → pink. Values are theme-aware
 * `--role-*` tokens from `globals.css` / `brand.css`, not raw hex.
 */
export const BRAND_AVATAR_ROLE_TOKENS = [
  'var(--role-green)',
  'var(--role-blue)',
  'var(--role-orange)',
  'var(--role-cyan)',
  'var(--role-purple)',
  'var(--role-teal)',
  'var(--role-pink)',
] as const;

export type BrandAvatarRoleToken = (typeof BRAND_AVATAR_ROLE_TOKENS)[number];

function paletteIndex(index: number): number {
  const length = BRAND_AVATAR_ROLE_TOKENS.length;
  return ((index % length) + length) % length;
}

/** Stable numeric id → brand role token (Contacts, Transcripts participants). */
export function brandAvatarToneFromId(id: number): BrandAvatarRoleToken {
  return BRAND_AVATAR_ROLE_TOKENS[paletteIndex(id)];
}

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/** String seed → brand role token (profile switcher, unnamed contacts). */
export function brandAvatarToneFromSeed(seed: string): BrandAvatarRoleToken {
  return BRAND_AVATAR_ROLE_TOKENS[paletteIndex(hashSeed(seed))];
}
