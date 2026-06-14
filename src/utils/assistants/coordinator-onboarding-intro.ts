import type { Transition } from 'framer-motion';
import type { BrandRole, CreatureShape } from '@/components/Brand/shapes';
import type { BotSkin, CreatureEyes, CreatureMood } from '@/components/Brand/TeammateCreature';

export type CoordinatorOnboardingIntroDroidAppearance = {
  baseEyes?: CreatureEyes;
  color: BrandRole;
  mood?: CreatureMood;
  shape: CreatureShape;
  /** Optional clothing drawn on the droid's body (e.g. a collar + tie). */
  skin?: BotSkin;
};

export type CoordinatorOnboardingIntroVoice = {
  audioSrc?: string;
  id?: string;
};

export const COORDINATOR_ONBOARDING_INTRO = {
  audioSrc: '/sounds/marty-onboarding-call-intro.mp3',
  preludeDurationMs: 20_540,
  fallbackDurationMs: 61_128,
  initialPauseMs: 1_000,
  backgroundStartDelayMs: 500,
  backgroundAccelerationMs: 2_400,
  callWarmupDelayMs: 0,
  // The visual handoff (avatar gliding into the docked call window)
  // waits until Marty has finished his pre-written speech, so the
  // elevator ascent spans the whole monologue rather than ending
  // early. Kept as a named lead so the dock can be nudged ahead of
  // the final word again if desired.
  handoffLeadMs: 0,
  landingDurationMs: 1_000,
};

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
  baseEyes: 'up',
  color: 'blue',
  mood: 'happy',
  shape: 'notch',
} satisfies CoordinatorOnboardingIntroDroidAppearance;

export const COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT = `Hi, I'm your coordinator droid.
I'm here to learn how your work runs, connect the tools you use, and help route recurring work to the right specialist droids.
No prompting, no setup jargon, and no configuration maze.
Talk to me like you would a teammate: priorities, workflows, documents, inboxes, calendars, handoffs, anything you want off your plate.
I'll walk you through the platform and get the first useful system in place with you.
Any immediate questions before we start?`;

export const COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION = {
  layout: {
    duration: 2.9,
    ease: [0.16, 1, 0.3, 1],
  },
} satisfies Transition;
