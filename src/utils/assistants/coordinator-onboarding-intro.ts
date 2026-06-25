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

export const COORDINATOR_ONBOARDING_DEFAULT_INITIAL_UNITY = {
  antenna: TWIN_CREATURE_APPEARANCE.antenna,
  baseEyes: 'square',
  body: 'standard',
  color: 'teal',
  mood: 'happy',
} satisfies CoordinatorOnboardingIntroUnityAppearance;
