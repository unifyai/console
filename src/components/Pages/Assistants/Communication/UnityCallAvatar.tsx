'use client';

import * as React from 'react';
import {
  AnimatedDroid as AnimatedUnity,
  Laptop,
  TWIN_CREATURE_APPEARANCE,
  getCreatureAccent,
  getDroidBodyForm as getUnityBodyForm,
} from '@unity/brand/components';
import type { BrandRole } from '@/components/Brand/shapes';
import type { UnityBody, UnityOutfit } from '@/components/Brand/unityAppearance';
import type {
  CreatureAntenna,
  CreatureEyes,
  CreatureMood,
  CreatureMouthShape,
} from '@/components/Brand/TeammateCreature';
import { cn } from '@/lib/utils';
import { clampUnitySpeechLevel } from '@/utils/assistants/unity-animation';
import { UnityTeleportFizzle } from '@/components/Pages/Assistants/Communication/UnityTeleportFizzle';

interface UnityCallAvatarProps {
  isSpeaking: boolean;
  isCallActive?: boolean;
  /** Whether the assistant has an in-flight `act`. Rotates the droid into its
   *  "working on a laptop" pose (laptop unfolds, keys flicker) while the body
   *  keeps lipsyncing, then turns back to face the screen when it ends. */
  isActing?: boolean;
  isUserSpeaking?: boolean;
  animateBodyMotion?: boolean;
  mood?: CreatureMood;
  mouthShape?: CreatureMouthShape;
  speechLevel?: number;
  className?: string;
  creatureClassName?: string;
  antenna?: CreatureAntenna;
  body?: UnityBody;
  color?: BrandRole;
  baseEyes?: CreatureEyes;
  outfit?: UnityOutfit;
  label?: string;
  /** Fade in once when the avatar first mounts. Set by the coordinator
   *  onboarding handoff so the docked unity reappears after the intro fade-out. */
  teleportInOnMount?: boolean;
}

// Resting pose: faces the screen (matches the default front-on framing). The
// "working" pose turns the body to the right toward the held laptop. Both are
// tunable; the laptop placement below is matched to WORKING_VIEW.
const CAMERA_VIEW = { yaw: 0, tilt: 7 } as const;
const WORKING_VIEW = { yaw: 42, tilt: 18 } as const;

const FOLD_DURATION_MS = 520;

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Animates the laptop lid open (1) / closed (0) over FOLD_DURATION_MS. */
function useLaptopFold(open: boolean): number {
  const [fold, setFold] = React.useState(0);
  const foldRef = React.useRef(0);

  React.useEffect(() => {
    const to = open ? 1 : 0;
    const from = foldRef.current;
    if (from === to) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      foldRef.current = to;
      setFold(to);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FOLD_DURATION_MS);
      const value = from + (to - from) * easeInOutQuad(t);
      foldRef.current = value;
      setFold(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return fold;
}

export function UnityCallAvatar({
  isSpeaking,
  isActing = false,
  isUserSpeaking = false,
  animateBodyMotion = true,
  mood = 'happy',
  mouthShape,
  speechLevel,
  className,
  creatureClassName,
  antenna = TWIN_CREATURE_APPEARANCE.antenna,
  body = 'standard',
  color = 'green',
  baseEyes = 'up',
  outfit = 'none',
  label = 'T-W1N',
  teleportInOnMount = false,
}: UnityCallAvatarProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const fold = useLaptopFold(isActing);
  const showLaptop = fold > 0.001;
  // Keep the rotation/laptop machinery engaged through the close animation so
  // the body can turn all the way back to camera before reverting to the
  // static pose; idle callers (hire form, chat bubble) never reach this.
  const working = isActing || showLaptop;

  const displayedSpeechLevel = clampUnitySpeechLevel(speechLevel ?? 0);
  const displayedMouthShape =
    mouthShape ?? (displayedSpeechLevel > 0.08 && isSpeaking ? 'narrow' : 'closed');
  const animatedVisualStyle = {
    '--unity-speech-level': displayedSpeechLevel.toFixed(3),
  } as React.CSSProperties;

  // Speech + eyes stay live for the whole call (`active`); the body rotation is
  // driven separately by `poseActive` so the mouth keeps animating while the
  // droid is turned to its laptop. Idle callers keep the static front pose.
  const unity = (
    <AnimatedUnity
      antenna={antenna}
      className={cn('h-full w-full', creatureClassName)}
      accent={getCreatureAccent(color)}
      active
      disableSpeechMotion={!animateBodyMotion}
      form={getUnityBodyForm(body)}
      emotion={mood}
      isSpeaking={isSpeaking}
      isUserSpeaking={isUserSpeaking}
      restingEyes={isHovered ? 'square' : baseEyes}
      stableBox
      speechLevel={displayedSpeechLevel}
      mouthShape={displayedMouthShape}
      skin={outfit}
      {...(working
        ? { poseActive: isActing, restView: CAMERA_VIEW, activeView: WORKING_VIEW }
        : { fixed: 1 })}
    />
  );

  // When idle the wrapper is transparent to layout (`display: contents`) so the
  // droid sizes exactly as it did before; while working it becomes a positioned
  // box that anchors the laptop overlay.
  const composed = (
    <span
      style={
        working
          ? { position: 'relative', display: 'block', width: '100%', height: '100%' }
          : { display: 'contents' }
      }
    >
      {unity}
      {showLaptop && (
        <span
          aria-hidden="true"
          data-testid="unity-call-laptop"
          style={{
            position: 'absolute',
            left: '54%',
            top: '70%',
            width: '70%',
            transform: 'translate(-50%, -50%)',
            opacity: fold,
            pointerEvents: 'none',
          }}
        >
          <Laptop fold={fold} />
        </span>
      )}
    </span>
  );

  return (
    <span
      className={cn('flex h-full w-full items-center justify-center overflow-visible', className)}
      aria-label={label}
      data-testid="unity-call-avatar"
      data-acting={isActing ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="img"
      style={animatedVisualStyle}
    >
      {teleportInOnMount ? (
        <UnityTeleportFizzle mode="in" className="flex h-full w-full items-center justify-center">
          {composed}
        </UnityTeleportFizzle>
      ) : (
        composed
      )}
    </span>
  );
}
