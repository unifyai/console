import type { Transition } from 'framer-motion';
import { MARTY_CREATURE_APPEARANCE } from '@droid/brand/components';
import {
  MARTY_ONBOARDING_INTRO_AUDIO_SRC,
  MARTY_ONBOARDING_INTRO_CLOSING_QUESTION_SEC,
  MARTY_ONBOARDING_INTRO_DURATION_MS,
  MARTY_ONBOARDING_INTRO_TRANSCRIPT,
} from '@droid/brand/audio';
import type { BrandRole } from '@/components/Brand/shapes';
import type {
  CreatureAntenna,
  CreatureEyes,
  CreatureMood,
} from '@/components/Brand/TeammateCreature';
import type { DroidBody, DroidOutfit } from '@/components/Brand/droidAppearance';

export type CoordinatorOnboardingIntroDroidAppearance = {
  antenna?: CreatureAntenna;
  baseEyes?: CreatureEyes;
  body: DroidBody;
  color: BrandRole;
  mood?: CreatureMood;
  /** Optional clothing drawn on the droid's body (e.g. a collar + tie). */
  outfit?: DroidOutfit;
};

export const COORDINATOR_ONBOARDING_INTRO = {
  audioSrc: MARTY_ONBOARDING_INTRO_AUDIO_SRC,
  backgroundMusicSrc: '/sounds/neo-background-music.mp3',
  backgroundMusicVolume: 0.14,
  // Served from public/sounds; canonical assets are owned by branding
  // (assets/audio/droid/onboarding/*.mp3).
  ascentAudioSrc: '/sounds/space-elevator-ascent.mp3',
  cityAmbienceSrc: '/sounds/coruscant-city-ambience.mp3',
  closingQuestionSec: MARTY_ONBOARDING_INTRO_CLOSING_QUESTION_SEC,
  fallbackDurationMs: MARTY_ONBOARDING_INTRO_DURATION_MS,
  initialPauseMs: 1_000,
  backgroundStartDelayMs: 500,
  backgroundAccelerationMs: 2_400,
  // Keep the city ascent running through the speech rather than ending early.
  handoffLeadMs: 0,
  surfaceRevealLeadMs: 3_000,
  teleportOutDelayMs: 500,
  landingDurationMs: 450,
} as const;

export type CoordinatorOnboardingIntroConfig = typeof COORDINATOR_ONBOARDING_INTRO;

/**
 * Wall-clock duration (ms) of the pre-recorded intro from the moment
 * the intro mounts to the moment Marty stops speaking — i.e. when the
 * user may start talking. Drives the "Intro" countdown badge. Honours
 * the same runtime duration override the intro animation reads so the
 * badge stays in lockstep during tests and previews.
 */
export function getCoordinatorIntroCountdownMs(): number {
  const { initialPauseMs, fallbackDurationMs } = COORDINATOR_ONBOARDING_INTRO;
  if (typeof window === 'undefined') {
    return initialPauseMs + fallbackDurationMs;
  }
  const runtimeWindow = window as unknown as Record<string, number | undefined>;
  const runtimeDurationMs = runtimeWindow['__COORDINATOR_ONBOARDING_INTRO_DURATION_MS'];
  return initialPauseMs + (runtimeDurationMs ?? fallbackDurationMs);
}

export const COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID = {
  antenna: MARTY_CREATURE_APPEARANCE.antenna,
  baseEyes: 'square',
  body: 'standard',
  color: 'teal',
  mood: 'happy',
} satisfies CoordinatorOnboardingIntroDroidAppearance;

export const COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT = MARTY_ONBOARDING_INTRO_TRANSCRIPT;

export const COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION = {
  layout: {
    duration: 2.9,
    ease: [0.16, 1, 0.3, 1],
  },
} satisfies Transition;
