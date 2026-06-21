'use client';

import * as React from 'react';
import {
  AnimatedDroid,
  getCreatureAccent,
  getDroidBodyForm,
  getRotatingBotAnchorRatios,
} from '@droid/brand/components';
import type { CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { clampDroidSpeechLevel } from '@/utils/assistants/droid-animation';
import type { CoordinatorOnboardingIntroDroidAppearance } from '@/utils/assistants/coordinator-onboarding-intro';

/**
 * Target render width (px) of an onboarding-intro droid. Held constant across
 * shapes — like the landing-page hero conveyor — so droids vary only in height
 * as they slide past, and constant across aspect ratios so Twin reads at the
 * same (larger) size whether the window is full or half width.
 */
export const COORDINATOR_ONBOARDING_DROID_WIDTH_PX = 176;

// Each droid sits in a square frame a bit wider than the droid itself; the gap
// is the spacing seen between droids as the wardrobe selector slides.
const DROID_FRAME_TO_WIDTH_RATIO = 4 / 3;
// Only shrink below the target on viewports too narrow to fit it, so the droid
// never overflows a small window.
const DROID_MAX_VIEWPORT_FRACTION = 0.46;
const COORDINATOR_INTRO_SPEECH_EYE_CONFIG = {
  expressionSequence: ['square', 'up'] as const,
};

function computeDroidWidth(viewportWidth: number) {
  return Math.round(
    Math.min(COORDINATOR_ONBOARDING_DROID_WIDTH_PX, viewportWidth * DROID_MAX_VIEWPORT_FRACTION)
  );
}

/**
 * Viewport-responsive sizing for the onboarding droids. Returns the droid
 * render ``width`` plus the square ``frame`` size used for the selector cells,
 * slide pitch, and avatar boxes — keep them in lockstep so the slide math and
 * the per-droid baseline stay correct as the size changes.
 */
export function useCoordinatorDroidLayout() {
  const [droidWidth, setDroidWidth] = React.useState(COORDINATOR_ONBOARDING_DROID_WIDTH_PX);

  React.useEffect(() => {
    const update = () => setDroidWidth(computeDroidWidth(window.innerWidth || 1024));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return { droidWidth, framePx: Math.round(droidWidth * DROID_FRAME_TO_WIDTH_RATIO) };
}

/**
 * A droid seated on the bottom edge of its (relatively-positioned) parent.
 *
 * Different brand forms have different viewBoxes, and the SVG centres itself
 * with the default ``xMidYMid meet``, so neither centring nor bottom-aligning
 * the box lands the *feet* on a common line. We use the brand's
 * ``getRotatingBotAnchorRatios`` (the same data the hero conveyor uses) for the
 * *vertical* seat: the droid is sized by width and translated down so its
 * ground point sits exactly on the parent's bottom edge. Drop several of these
 * into equal-height parents and they all read as standing on one surface.
 *
 * Horizontally we keep the droid's body centred in its box (a plain
 * ``-50%``) rather than anchoring the ground point: these avatars sit alone in
 * a centred slot, so the body mass — not the projected foot — is what needs to
 * line up with the centre.
 *
 * The parent must be ``position: relative`` and define the baseline via its
 * own height (the droid seats on ``bottom: 0``).
 */
export function SeatedCoordinatorDroid({
  droid,
  width = COORDINATOR_ONBOARDING_DROID_WIDTH_PX,
  isSpeaking,
  mouthShape = 'closed',
  speechLevel,
}: {
  droid: CoordinatorOnboardingIntroDroidAppearance;
  width?: number;
  isSpeaking: boolean;
  mouthShape?: CreatureMouthShape;
  speechLevel?: number;
}) {
  const form = getDroidBodyForm(droid.body);
  const anchor = getRotatingBotAnchorRatios(form);

  return (
    <span
      aria-hidden
      className="absolute bottom-0 left-1/2 block drop-shadow-sm"
      style={{
        width: `${width}px`,
        transform: `translate(-50%, ${(anchor.y * width).toFixed(2)}px)`,
      }}
    >
      <AnimatedDroid
        accent={getCreatureAccent(droid.color)}
        // ``active`` gates all face animation in the brand droid (the mouth
        // only lipsyncs when ``active && isSpeaking``). It must stay true —
        // ``DroidCallAvatar`` hardcodes it the same way — or the voice would
        // never drive the mouth.
        active
        antenna={droid.antenna}
        className="block h-auto w-full"
        disableSpeechMotion
        disableEmotionEyePool
        emotion={droid.mood ?? 'happy'}
        fixed={1}
        form={form}
        isSpeaking={isSpeaking}
        mouthShape={mouthShape}
        restingEyes={droid.baseEyes ?? 'up'}
        speechEyeConfig={COORDINATOR_INTRO_SPEECH_EYE_CONFIG}
        skin={droid.outfit}
        speechLevel={clampDroidSpeechLevel(speechLevel ?? 0)}
        stableBox
      />
    </span>
  );
}
