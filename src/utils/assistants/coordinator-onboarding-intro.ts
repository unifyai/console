import type { Transition } from 'framer-motion';
import type { BrandRole, CreatureShape } from '@/components/Brand/shapes';
import type { CreatureEyes, CreatureMood } from '@/components/Brand/TeammateCreature';

export type CoordinatorOnboardingIntroDroidAppearance = {
  baseEyes?: CreatureEyes;
  color: BrandRole;
  mood?: CreatureMood;
  shape: CreatureShape;
};

export type CoordinatorOnboardingIntroVoice = {
  audioSrc?: string;
  id?: string;
};

export const COORDINATOR_ONBOARDING_INTRO = {
  audioSrc: '/sounds/marty-onboarding-call-intro.mp3',
  preludeDurationMs: 21_528,
  fallbackDurationMs: 62_088,
  initialPauseMs: 1_000,
  backgroundStartDelayMs: 500,
  backgroundAccelerationMs: 2_400,
  callWarmupDelayMs: 0,
  handoffLeadMs: 6_500,
  landingDurationMs: 1_000,
};

export type CoordinatorOnboardingIntroConfig = typeof COORDINATOR_ONBOARDING_INTRO;

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
