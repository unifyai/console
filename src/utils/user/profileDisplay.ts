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

export { brandAvatarToneFromSeed as profileAvatarTone } from '@/utils/brand/avatarPalette';
