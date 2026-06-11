import type { CreatureEyes } from '@/components/Brand/TeammateCreature';

const SPEAKING_EYES_BY_BASE: Record<CreatureEyes, CreatureEyes[]> = {
  up: ['up', 'square', 'down', 'square'],
  down: ['down', 'square', 'up', 'square'],
  square: ['square', 'up', 'square', 'down'],
  blink: ['blink', 'up', 'square', 'up'],
};

export function getSpeakingEyes(baseEyes: CreatureEyes, frame: number): CreatureEyes {
  return SPEAKING_EYES_BY_BASE[baseEyes][frame % SPEAKING_EYES_BY_BASE[baseEyes].length];
}

export function clampDroidSpeechLevel(level: number): number {
  return Math.max(0, Math.min(1, level));
}

export function getDroidSpeechTransform(level: number): string {
  const speechLevel = clampDroidSpeechLevel(level);
  return `translateY(${-speechLevel * 3}px) scale(${1 + speechLevel * 0.004})`;
}
