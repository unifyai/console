import type { CreatureMood } from '@/components/Brand/TeammateCreature';

export type FastBrainMood = 'neutral/happy' | 'apologetic/sad' | 'frustrated/angry' | 'bored';

export const DEFAULT_AVATAR_MOOD = 'happy' satisfies CreatureMood;

export interface ParsedMoodClassification {
  mood: CreatureMood;
  turnIndex: number;
}

export function mapFastBrainMoodToDroidMood(value: unknown): CreatureMood | null {
  switch (value) {
    case 'neutral/happy':
    case 'happy':
      return 'happy';
    case 'apologetic/sad':
    case 'apologetic':
    case 'sad':
      return 'sad';
    case 'frustrated/angry':
    case 'frustrated':
      return 'frustrated';
    case 'bored':
      return 'happy';
    default:
      return null;
  }
}

export function parseMoodClassificationMessage(
  data: unknown,
  lastTurnIndex: number
): ParsedMoodClassification | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  if (payload.type !== 'mood_classification') return null;

  const rawTurnIndex = payload.turnIndex;
  const turnIndex =
    typeof rawTurnIndex === 'number'
      ? rawTurnIndex
      : typeof rawTurnIndex === 'string'
        ? Number.parseInt(rawTurnIndex, 10)
        : Number.NaN;
  if (!Number.isFinite(turnIndex) || turnIndex <= lastTurnIndex) return null;

  const mood =
    mapFastBrainMoodToDroidMood(payload.avatarMood) ?? mapFastBrainMoodToDroidMood(payload.mood);
  if (!mood) return null;

  return { mood, turnIndex };
}
