import type { User } from '@/types/user';
import { contactAvatarTone } from '@/utils/assistants/contacts';

/** First + last name for account and personal-workspace labels. */
export function userFullName(user: Pick<User, 'name' | 'lastName'>): string {
  return `${user.name ?? ''} ${user.lastName ?? ''}`.trim();
}

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

/** Initials for the signed-in user (matches Contacts when both names are set). */
export function userInitials(user: Pick<User, 'name' | 'lastName' | 'email'>): string {
  const full = userFullName(user);
  if (full) return profileInitials(full);
  return user.email?.trim().charAt(0).toUpperCase() || '?';
}

/** Avatar tint aligned with Contacts (`contactAvatarTone`). */
export function profileAvatarTone(name: string, contactId?: number | null): string {
  return contactAvatarTone(contactId ?? null, name);
}
