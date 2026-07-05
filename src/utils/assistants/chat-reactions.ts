import type { MessageReaction } from '@/types/assistants/chat';

const REACTION_AUDIT_MEDIUMS = new Set(['unify_reaction', 'whatsapp_reaction']);

export function isReactionAuditMedium(medium: unknown): boolean {
  return typeof medium === 'string' && REACTION_AUDIT_MEDIUMS.has(medium);
}

export function mapTranscriptReactions(metadata: unknown): MessageReaction[] | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const raw = (metadata as Record<string, unknown>).reactions;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const reactions = raw
    .map((item): MessageReaction | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const contactId = record.contactId ?? record.contact_id;
      const emoji = record.emoji;
      if (typeof contactId !== 'number' || typeof emoji !== 'string' || !emoji.trim()) {
        return null;
      }
      const updatedRaw = record.updatedAt ?? record.updated_at;
      return {
        contactId,
        emoji,
        ...(typeof updatedRaw === 'string' ? { updatedAt: new Date(updatedRaw) } : {}),
      };
    })
    .filter((item): item is MessageReaction => item !== null);

  return reactions.length > 0 ? reactions : undefined;
}

export function applyReactionUpdate(
  messages: MessageReaction[] | undefined,
  contactId: number,
  emoji: string | null
): MessageReaction[] {
  const existing = [...(messages ?? [])];
  const index = existing.findIndex((item) => item.contactId === contactId);
  if (!emoji) {
    if (index === -1) return existing;
    existing.splice(index, 1);
    return existing;
  }
  const next: MessageReaction = {
    contactId,
    emoji,
    updatedAt: new Date(),
  };
  if (index === -1) {
    existing.push(next);
    return existing;
  }
  if (existing[index]?.emoji === emoji) {
    existing.splice(index, 1);
    return existing;
  }
  existing[index] = next;
  return existing;
}
