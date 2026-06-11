import { VISEMES } from 'wawa-lipsync';
import type { CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { clampDroidSpeechLevel } from '@/utils/assistants/droid-animation';

export interface DroidLipsyncFrame {
  mouthShape: CreatureMouthShape;
  speechLevel: number;
  viseme: VISEMES;
  isActive: boolean;
}

export const DROID_IDLE_LIPSYNC_FRAME: DroidLipsyncFrame = {
  mouthShape: 'closed',
  speechLevel: 0,
  viseme: VISEMES.sil,
  isActive: false,
};

export function getDroidSpeechLevel(volume: number): number {
  return clampDroidSpeechLevel(Math.sqrt(Math.max(0, volume - 0.045)) * 1.05);
}

export function getDroidMouthShape(viseme: VISEMES, speechLevel: number): CreatureMouthShape {
  switch (viseme) {
    case VISEMES.PP:
    case VISEMES.FF:
    case VISEMES.TH:
      return 'narrow';
    case VISEMES.O:
    case VISEMES.U:
      return 'round';
    case VISEMES.aa:
      return 'open';
    case VISEMES.E:
    case VISEMES.I:
      return 'wide';
    case VISEMES.DD:
    case VISEMES.kk:
    case VISEMES.CH:
    case VISEMES.SS:
    case VISEMES.nn:
    case VISEMES.RR:
      return 'narrow';
    case VISEMES.sil:
      return speechLevel > 0.08 ? 'narrow' : 'closed';
    default:
      return 'closed';
  }
}

export function getDroidLipsyncFrame(viseme: VISEMES, volume: number): DroidLipsyncFrame {
  const speechLevel = getDroidSpeechLevel(volume);
  return {
    mouthShape: getDroidMouthShape(viseme, speechLevel),
    speechLevel,
    viseme,
    isActive: speechLevel > 0.08 || viseme !== VISEMES.sil,
  };
}
