import { TWIN_CREATURE_APPEARANCE } from '@unity/brand/components';
import type { BrandRole } from '@/components/Brand/shapes';
import type {
  CreatureAntenna,
  CreatureEyes,
  CreatureMood,
} from '@/components/Brand/TeammateCreature';
import type { UnityBody, UnityOutfit } from '@/components/Brand/unityAppearance';

export type CoordinatorOnboardingIntroUnityAppearance = {
  antenna?: CreatureAntenna;
  baseEyes?: CreatureEyes;
  body: UnityBody;
  color: BrandRole;
  mood?: CreatureMood;
  /** Optional clothing drawn on the unity's body (e.g. a collar + tie). */
  outfit?: UnityOutfit;
};

/** Delay before showing the typing indicator after chat pick (UI only). */
export const COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_DELAY_MS = 500;

/** Typing duration before the scripted chat opener is delivered (pairs with Unity). */
export const COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_MS = 3500;

/** Drop the forced typing hint if the opener never lands. */
export const COORDINATOR_ONBOARDING_CHAT_INTRO_TYPING_FALLBACK_MS = 15000;

export const COORDINATOR_ONBOARDING_DEFAULT_INITIAL_UNITY = {
  antenna: TWIN_CREATURE_APPEARANCE.antenna,
  baseEyes: 'square',
  body: 'standard',
  color: 'teal',
  mood: 'happy',
} satisfies CoordinatorOnboardingIntroUnityAppearance;
