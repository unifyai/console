import type { Transition } from 'framer-motion';

export const COORDINATOR_ONBOARDING_INTRO = {
  audioSrc: '/sounds/marty-onboarding-intro.mp3?v=20260609-v3-verified',
  fallbackDurationMs: 33_570,
  initialPauseMs: 1_000,
  backgroundStartDelayMs: 500,
  backgroundAccelerationMs: 2_400,
  callWarmupLeadMs: 2_500,
  handoffLeadMs: 6_500,
  landingDurationMs: 1_000,
  backgroundPixelsPerSecond: 36,
};

export type CoordinatorOnboardingIntroConfig = typeof COORDINATOR_ONBOARDING_INTRO;

export const COORDINATOR_ONBOARDING_MARTY_LAYOUT_TRANSITION = {
  layout: {
    duration: 2.9,
    ease: [0.16, 1, 0.3, 1],
  },
} satisfies Transition;
