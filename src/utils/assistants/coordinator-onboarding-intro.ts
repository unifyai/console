import type { Transition } from 'framer-motion';
import { TWIN_CREATURE_APPEARANCE } from '@droid/brand/components';
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
