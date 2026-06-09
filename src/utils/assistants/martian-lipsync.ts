import { VISEMES } from 'wawa-lipsync';
import type { CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { clampMartianSpeechLevel } from '@/utils/assistants/martian-animation';

export interface MartianLipsyncFrame {
  mouthShape: CreatureMouthShape;
  speechLevel: number;
  viseme: VISEMES;
  isActive: boolean;
}

export const MARTIAN_IDLE_LIPSYNC_FRAME: MartianLipsyncFrame = {
  mouthShape: 'closed',
  speechLevel: 0,
  viseme: VISEMES.sil,
  isActive: false,
};

export function getMartianSpeechLevel(volume: number): number {
  return clampMartianSpeechLevel(Math.sqrt(Math.max(0, volume - 0.045)) * 1.05);
}

export function getMartianMouthShape(viseme: VISEMES, speechLevel: number): CreatureMouthShape {
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

export function getMartianLipsyncFrame(viseme: VISEMES, volume: number): MartianLipsyncFrame {
  const speechLevel = getMartianSpeechLevel(volume);
  return {
    mouthShape: getMartianMouthShape(viseme, speechLevel),
    speechLevel,
    viseme,
    isActive: speechLevel > 0.08 || viseme !== VISEMES.sil,
  };
}
