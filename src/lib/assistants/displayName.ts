import type { Assistant } from '@/types/assistants/assistant';

type AssistantIdentityLike = Pick<Assistant, 'isCoordinator' | 'firstName' | 'surname'> &
  Partial<Pick<Assistant, 'isMultiplayer'>>;

function normalizeNamePart(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Formats an assistant display name for UI surfaces.
 *
 * Single-player coordinators always render with the shared T-W1N name.
 * Multiplayer twins carry their own chosen name like any hired teammate.
 * Non-coordinator names are whitespace-trimmed and null-safe to avoid
 * leaking placeholder strings.
 */
export const COORDINATOR_DISPLAY_NAME = 'T-W1N';

export function assistantDisplayName(
  assistant: AssistantIdentityLike | null | undefined,
  fallback = 'Assistant'
): string {
  if (!assistant) return fallback;
  if (assistant.isCoordinator && !assistant.isMultiplayer) return COORDINATOR_DISPLAY_NAME;

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
