/**
 * View-model mapping for the Brain → Contacts directory view.
 *
 * Field inventory is the `Contact` pydantic model in the unity repo
 * (`contact_manager/types/contact.py`). The `/api/logs` route runs the body
 * through `createOrchestraClient`, which deep-converts snake→camel, so `entries`
 * reach this mapper in camelCase. `readField(snake, camel)` resolves the camel
 * key at runtime and keeps the snake key as a harmless fallback.
 */

import type { ContactRow } from '@/types/assistants/brain';
import { brandAvatarToneFromId, brandAvatarToneFromSeed } from '@/utils/brand/avatarPalette';

export interface ContactCard {
  contactId: number | null;
  firstName: string;
  surname: string;
  fullName: string;
  initials: string;
  jobTitle: string;
  email: string;
  phone: string;
  whatsapp: string;
  discord: string;
  slack: string;
  timezone: string;
  bio: string;
  rollingSummary: string;
  responsePolicy: string;
  shouldRespond: boolean;
  isSystem: boolean;
  tags: string[];
}

function readField(row: Record<string, unknown>, snake: string, camel: string): unknown {
  const camelValue = row[camel];
  if (camelValue !== undefined && camelValue !== null) return camelValue;
  return row[snake];
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item) => item.length > 0);
}

/** Up-to-two-letter initials from a contact's name (falls back to email/`?`). */
export function contactInitials(firstName: string, surname: string, email: string): string {
  const f = firstName.trim();
  const s = surname.trim();
  if (f || s) return `${f.charAt(0)}${s.charAt(0)}`.toUpperCase() || f.charAt(0).toUpperCase();
  const e = email.trim();
  return e ? e.charAt(0).toUpperCase() : '?';
}

/**
 * Deterministic avatar tint from the shared brand initials palette (see
 * `utils/brand/avatarPalette.ts`). Prefer numeric contact ids when present so
 * the directory matches the platform design's `colorFor(id)` behaviour.
 */
export function contactAvatarTone(contactId: number | null, seed: string): string {
  if (contactId !== null && Number.isFinite(contactId)) {
    return brandAvatarToneFromId(contactId);
  }
  return brandAvatarToneFromSeed(seed);
}

export function mapContactRow(row: ContactRow): ContactCard {
  const raw = row as unknown as Record<string, unknown>;

  const firstName = asString(readField(raw, 'first_name', 'firstName'));
  const surname = asString(readField(raw, 'surname', 'surname'));
  const email = asString(readField(raw, 'email_address', 'emailAddress'));

  const contactIdRaw = readField(raw, 'contact_id', 'contactId');
  const contactId =
    typeof contactIdRaw === 'number'
      ? contactIdRaw
      : Number.isFinite(Number(contactIdRaw))
        ? Number(contactIdRaw)
        : null;

  const fullName = [firstName, surname].filter(Boolean).join(' ').trim() || email || 'Unnamed';
  const shouldRespondRaw = readField(raw, 'should_respond', 'shouldRespond');

  return {
    contactId,
    firstName,
    surname,
    fullName,
    initials: contactInitials(firstName, surname, email),
    jobTitle: asString(readField(raw, 'job_title', 'jobTitle')),
    email,
    phone: asString(readField(raw, 'phone_number', 'phoneNumber')),
    whatsapp: asString(readField(raw, 'whatsapp_number', 'whatsappNumber')),
    discord: asString(readField(raw, 'discord_id', 'discordId')),
    slack: asString(readField(raw, 'slack_user_id', 'slackUserId')),
    timezone: asString(readField(raw, 'timezone', 'timezone')),
    bio: asString(readField(raw, 'bio', 'bio')),
    rollingSummary: asString(readField(raw, 'rolling_summary', 'rollingSummary')),
    responsePolicy: asString(readField(raw, 'response_policy', 'responsePolicy')),
    // Default true mirrors the pydantic default; only an explicit `false` disables.
    shouldRespond: shouldRespondRaw !== false,
    isSystem: readField(raw, 'is_system', 'isSystem') === true,
    tags: asStringArray(readField(raw, 'tags', 'tags')),
  };
}

/** All distinct tags across the directory, sorted for stable filter chips. */
export function collectContactTags(cards: ContactCard[]): string[] {
  const set = new Set<string>();
  cards.forEach((c) => c.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterContacts(
  cards: ContactCard[],
  query: string,
  selectedTags: string[]
): ContactCard[] {
  const q = query.trim().toLowerCase();
  return cards.filter((c) => {
    if (selectedTags.length > 0 && !selectedTags.every((t) => c.tags.includes(t))) return false;
    if (!q) return true;
    return `${c.fullName} ${c.jobTitle} ${c.email}`.toLowerCase().includes(q);
  });
}
