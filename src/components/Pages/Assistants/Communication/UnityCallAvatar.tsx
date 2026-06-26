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

// Resting pose: faces the screen head-on (eye contact on a call). The "working"
// pose turns the body into the landing page's isometric hero angle, which is the
// exact projection the `Laptop` SVG is designed against — so the held laptop
// lines up the same way it does on the landing hub. Both views share the {0,7}
// endpoint (idle == working p=0) so entering/leaving the pose is seamless.
const CAMERA_VIEW = { yaw: 0, tilt: 7 } as const;
const WORKING_VIEW = { yaw: 45, tilt: 30 } as const;

// Match the landing hub exactly: lid hinge over 520ms (easeInOutQuad) and a
// 0.5s ease opacity fade as the laptop appears/disappears during the turn.
const LID_DURATION_MS = 520;
const LAPTOP_FADE = 'opacity 0.5s ease';

// Placement of the open laptop relative to the droid box, tuned against the
// droid at WORKING_VIEW (the landing isometric pose) via an offline render: a
// large laptop sitting in front of the droid's lower body, with the eyes still
// reading above the raised lid. Width > 100% intentionally — the open laptop
// is meant to be prominent (overflow is visible on the avatar).
const LAPTOP_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: '52%',
  top: '80%',
  width: '110%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Animates lid openness 0 (closed) → 1 (fully open) over LID_DURATION_MS.
 * NOTE: the `Laptop` SVG's own `fold` prop is inverted (0 = open, 1 = closed),
 * so callers pass `fold={1 - openness}`.
 */
function useLidOpen(open: boolean): number {
  const [openness, setOpenness] = React.useState(0);
  const ref = React.useRef(0);

  React.useEffect(() => {
    const to = open ? 1 : 0;
    const from = ref.current;
    if (from === to) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      ref.current = to;
      setOpenness(to);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / LID_DURATION_MS);
      const value = from + (to - from) * easeInOutQuad(t);
      ref.current = value;
      setOpenness(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return openness;
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
  const lidOpen = useLidOpen(isActing);
  // Keep the rotation/laptop machinery engaged through the close animation so
  // the body can turn all the way back to camera before reverting to the
  // static pose; idle callers (hire form, chat bubble) never reach this.
  const working = isActing || lidOpen > 0.001;

  // Opacity fade is driven by an effect (not `fold`) so the laptop mounts at
  // opacity 0 and transitions to 1 — matching the landing hub's CSS fade. On
  // mount `working` is already true but this stays false until after paint, so
  // the 0→1 edge actually animates; flips back to false to fade out on the turn.
  const [laptopVisible, setLaptopVisible] = React.useState(false);
  React.useEffect(() => {
    setLaptopVisible(isActing);
  }, [isActing]);

  const displayedSpeechLevel = clampUnitySpeechLevel(speechLevel ?? 0);
  const displayedMouthShape =
    mouthShape ?? (displayedSpeechLevel > 0.08 && isSpeaking ? 'narrow' : 'closed');
  const animatedVisualStyle = {
    '--unity-speech-level': displayedSpeechLevel.toFixed(3),
  } as React.CSSProperties;

  // Speech + eyes stay live for the whole call (`active`); the body rotation is
  // driven separately by `poseActive` and is ALWAYS controlled (never `fixed`),
  // exactly like the landing droids — so the droid smoothly turns to the laptop
  // when acting and smoothly turns back to face the screen when it ends (no
  // snap). Idle == `poseActive` false == restView (head-on, eye contact).
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
      poseActive={isActing}
      restView={CAMERA_VIEW}
      activeView={WORKING_VIEW}
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
      {working && (
        <span
          aria-hidden="true"
          data-testid="unity-call-laptop"
          style={{
            ...LAPTOP_STYLE,
            opacity: laptopVisible ? 1 : 0,
            transition: LAPTOP_FADE,
          }}
        >
          <Laptop fold={1 - lidOpen} />
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
