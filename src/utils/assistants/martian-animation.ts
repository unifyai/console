import type { CreatureEyes } from '@/components/Brand/TeammateCreature';

const SPEAKING_EYES_BY_BASE: Record<CreatureEyes, CreatureEyes[]> = {
  up: ['up', 'square', 'down', 'square'],
  down: ['down', 'square', 'up', 'square'],
  square: ['square', 'up', 'square', 'down'],
};

export function getSpeakingEyes(baseEyes: CreatureEyes, frame: number): CreatureEyes {
  return SPEAKING_EYES_BY_BASE[baseEyes][frame % SPEAKING_EYES_BY_BASE[baseEyes].length];
}

export function clampMartianSpeechLevel(level: number): number {
  return Math.max(0, Math.min(1, level));
}

export function getMartianSpeechTransform(level: number): string {
  const speechLevel = clampMartianSpeechLevel(level);
  return `translateY(${-speechLevel * 3}px) scale(${1 + speechLevel * 0.004})`;
}
