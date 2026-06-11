import type { Assistant } from '@/types/assistants/assistant';

type AssistantIdentityLike = Pick<Assistant, 'isCoordinator' | 'firstName' | 'surname'>;

function normalizeNamePart(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Formats an assistant display name for UI surfaces.
 *
 * Coordinators always render with the public coordinator droid name. Non-coordinator names
 * are whitespace-trimmed and null-safe to avoid leaking placeholder strings.
 */
export function assistantDisplayName(
  assistant: AssistantIdentityLike | null | undefined,
  fallback = 'Assistant'
): string {
  if (!assistant) return fallback;
  if (assistant.isCoordinator) return 'Coordinator Droid';

  const fullName = [normalizeNamePart(assistant.firstName), normalizeNamePart(assistant.surname)]
    .filter(Boolean)
    .join(' ');
  return fullName || fallback;
}

/**
 * Builds null-safe initials from first/surname fields.
 */
export function assistantInitials(
  assistant: Pick<Assistant, 'firstName' | 'surname'> | null | undefined,
  fallback = 'A'
): string {
  if (!assistant) return fallback;
  const firstInitial = normalizeNamePart(assistant.firstName).charAt(0);
  const surnameInitial = normalizeNamePart(assistant.surname).charAt(0);
  const initials = `${firstInitial}${surnameInitial}`.toUpperCase();
  return initials || fallback;
}
