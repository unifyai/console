import type { Transition } from 'framer-motion';
import { TWIN_CREATURE_APPEARANCE } from '@droid/brand/components';
import type { BrandRole } from '@/components/Brand/shapes';
import type {
  CreatureAntenna,
  CreatureEyes,
  CreatureMood,
} from '@/components/Brand/TeammateCreature';
import type { DroidBody, DroidOutfit } from '@/components/Brand/droidAppearance';

const COORDINATOR_ONBOARDING_INTRO_CLOSING_QUESTION_SEC = 90.449;
const COORDINATOR_ONBOARDING_INTRO_DURATION_MS = 98_508;
const COORDINATOR_ONBOARDING_INTRO_AUDIO_SRC = '/sounds/twin-onboarding-intro.mp3';

export const COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT = `Hi, I'm T dash W 1 N.

Before you ask, no I'm not one of Elon's many children, and no he didn't come up with the name, thankfully.

I have this name because I'll be acting as your digital twin. Do you get it? Twin? Like T dash W 1 N spells Twin? The creators of this platform express how important it is that you acknowledge that it's a clever and funny name.

Okay, what next. They didn't give me much to work with on this intro to be honest.

Have you ever had a Krispy Kreme? Have you ever gone to Krispy Kreme?

Was it krispy?

I think I was meant to tell you about my capabilities?

I'm not one for bragging, but I'll do my best. Basically, I'm not a "tool", I'm not an "agent", I'm your living breathing copilot (metaphorically speaking. At the lawyers request).

Don't think about prompting me, or configuring me, just talk to me naturally like you would anyone else, and I'll be able to help. It's really that simple.

There's not much more to say.

Oh actually, I'm sorry I just found the script. I got ahead of myself. Let me start over.

Also, lets turn off this really annoying music.

Okay.

Hi there, you on the laptop. I wonder if you'd mind taking a brief survey?

Five questions. Now, I know you're sleepy, but I just bet it'll make you feel right as rain.

I'd be just thrilled to chat once we've run the survey. Shall we begin with question one?

Who are you? First name will do. It's okay, if you can't answer the question feel free to say unknown.`;

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
  audioSrc: COORDINATOR_ONBOARDING_INTRO_AUDIO_SRC,
  backgroundMusicSrc: '/sounds/neo-background-music.mp3',
  backgroundMusicVolume: 0.28,
  ascentAudioSrc: '/sounds/space-elevator-ascent.mp3',
  closingQuestionSec: COORDINATOR_ONBOARDING_INTRO_CLOSING_QUESTION_SEC,
  fallbackDurationMs: COORDINATOR_ONBOARDING_INTRO_DURATION_MS,
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
 * the intro mounts to the moment Twin stops speaking — i.e. when the
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
  antenna: TWIN_CREATURE_APPEARANCE.antenna,
  baseEyes: 'square',
  body: 'standard',
  color: 'teal',
  mood: 'happy',
} satisfies CoordinatorOnboardingIntroDroidAppearance;

export const COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION = {
  layout: {
    duration: 2.9,
    ease: [0.16, 1, 0.3, 1],
  },
} satisfies Transition;
