/** Builds up-to-two-letter initials from a display name. */
export function profileInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

const AVATAR_TONES = [
  'var(--role-green)',
  'var(--role-cyan)',
  'var(--role-purple)',
  'var(--role-orange)',
  'var(--role-teal)',
  'var(--role-pink)',
  'var(--role-blue)',
] as const;

/** Deterministic brand-token avatar tint from a stable seed. */
export function profileAvatarTone(seed: string): string {
  const basis = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_TONES[Math.abs(basis) % AVATAR_TONES.length];
}
