'use client';

import * as React from 'react';
import {
  AnimatedDroid as AnimatedUnity,
  Laptop,
  TWIN_CREATURE_APPEARANCE,
  getCreatureAccent,
  getDroidBodyForm as getUnityBodyForm,
  getRotatingBotLaptopLiftPx,
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
  /** Whether the droid should be turned into its "working on a laptop" pose
   *  (laptop unfolds, keys flicker) rather than facing the camera. The body keeps
   *  lipsyncing in either pose. Driven by the call window's pose state machine:
   *  the droid answers facing the camera and, once it turns to the laptop for
   *  work or silence, stays there for the rest of the call. Hover temporarily
   *  faces the screen again without changing this latch. */
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
  /** Pin the midpoint of every body form's blank lower front (the strip
   *  between the screen and the base) to the standard body's within the slot.
   *  The call window enables this so the slot-anchored laptop sits centred on
   *  each body's lower front, clear of every face; surfaces that position the
   *  avatar by viewBox math (hire preview, chat bubble pop) leave it off. */
  alignLaptop?: boolean;
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

// Placement of the open laptop in slot coordinates, tuned against the standard
// body at WORKING_VIEW (the landing isometric pose) via an offline render: a
// large laptop sitting in front of the droid's lower body, with the eyes still
// reading above the raised lid. The laptop is anchored to the slot — NOT to the
// body — because every body form is shifted so its lower-front midpoint matches
// the standard body's (see useLaptopAnchorLift), so one slot position lines up
// with every body's lower front.
//
// The squat wide body is the exception: its lower front (screen bottom → base)
// is ~13 slot-px tall versus the standard's ~24, so the shared laptop physically
// cannot sit inside it. That body gets a compact laptop profile, solved (via
// the same projective math as the lift) so the tray's contact band is centred
// on the strip with an equal band of body visible above and below it.
const LAPTOP_PROFILES: Record<'default' | 'wide', { left: string; top: string; width: string }> = {
  default: { left: '85%', top: '91%', width: '90%' },
  wide: { left: '80%', top: '93.1%', width: '68%' },
};

function laptopStyleForForm(form: ReturnType<typeof getUnityBodyForm>): React.CSSProperties {
  const profile = form === 'wide' ? LAPTOP_PROFILES.wide : LAPTOP_PROFILES.default;
  return {
    position: 'absolute',
    ...profile,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  };
}

function useLaptopAnchorLift(
  enabled: boolean,
  form: ReturnType<typeof getUnityBodyForm>,
  progress: number,
  antenna: CreatureAntenna,
  slotRef: React.RefObject<HTMLSpanElement | null>
) {
  const [liftPx, setLiftPx] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setLiftPx(0);
      return;
    }
    const slot = slotRef.current;
    if (!slot) return;

    const update = () => {
      const { width } = slot.getBoundingClientRect();
      if (width <= 0) return;
      // Reference defaults (standard body, no antenna) are the coordinator
      // look the laptop placement is tuned against.
      setLiftPx(
        getRotatingBotLaptopLiftPx(form, width, {
          pose: progress,
          restView: CAMERA_VIEW,
          activeView: WORKING_VIEW,
          antenna,
        })
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [antenna, enabled, form, progress, slotRef]);

  return liftPx;
}

/**
 * Animates the working-pose transition 0 (idle) → 1 (working) over
 * LID_DURATION_MS with an eased ramp. This single value drives BOTH:
 *   - the body turn, fed to RotatingBot as a self-animated `fixed` pose
 *     (0 = restView / head-on, 1 = activeView / isometric). Using `fixed`
 *     (a long-standing, always-present prop) rather than a controlled
 *     `active`/`poseActive` boolean makes the turn smooth in both directions
 *     AND independent of the brand package's own animation timing — so it
 *     can't regress if `@unity/brand` is served from a stale transpile.
 *   - the laptop lid (`fold={1 - progress}`, since `Laptop.fold` is inverted:
 *     0 = open, 1 = closed), so the lid unfolds exactly as the body turns.
 */
function useWorkingProgress(active: boolean): number {
  const [progress, setProgress] = React.useState(0);
  const ref = React.useRef(0);

  React.useEffect(() => {
    const to = active ? 1 : 0;
    const from = ref.current;
    if (from === to) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      ref.current = to;
      setProgress(to);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / LID_DURATION_MS);
      const value = from + (to - from) * easeInOutQuad(t);
      ref.current = value;
      setProgress(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return progress;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
  alignLaptop = false,
}: UnityCallAvatarProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const slotRef = React.useRef<HTMLSpanElement>(null);
  const form = getUnityBodyForm(body);
  // Call-state latch for the laptop pose; hover temporarily overrides the visual
  // turn so the droid faces the screen without clearing isActing.
  const turnedToLaptop = isActing && !isHovered;
  // 0 = idle (head-on, facing camera) … 1 = working (turned to the laptop).
  const progress = useWorkingProgress(turnedToLaptop);
  const liftPx = useLaptopAnchorLift(alignLaptop, form, progress, antenna, slotRef);
  // Keep the laptop mounted through the close animation so the lid can fold and
  // fade while the body turns back; idle callers (hire form, chat bubble) sit at
  // progress 0 and never mount it.
  const working = isActing || progress > 0.001;

  // Opacity fade is driven by an effect (not `fold`) so the laptop mounts at
  // opacity 0 and transitions to 1 — matching the landing hub's CSS fade. On
  // mount `working` is already true but this stays false until after paint, so
  // the 0→1 edge actually animates; flips back to false to fade out on the turn.
  const [laptopVisible, setLaptopVisible] = React.useState(false);
  React.useEffect(() => {
    setLaptopVisible(turnedToLaptop);
  }, [turnedToLaptop]);

  const displayedSpeechLevel = clampUnitySpeechLevel(speechLevel ?? 0);
  const displayedMouthShape =
    mouthShape ?? (displayedSpeechLevel > 0.08 && isSpeaking ? 'narrow' : 'closed');
  const animatedVisualStyle = {
    '--unity-speech-level': displayedSpeechLevel.toFixed(3),
  } as React.CSSProperties;

  // Turning to the laptop drops the droid's gaze to its work. Shifting the eyes
  // with the body makes the swivel read as a deliberate "getting to work"
  // gesture rather than a blank rotation.
  const poseRestingEyes: CreatureEyes = turnedToLaptop ? 'down' : baseEyes;

  // Speech + eyes stay live for the whole call via the bare `active` prop; the
  // body pose is driven by our own animated `progress` through `fixed` (0 =
  // restView/head-on, 1 = activeView/isometric). `fixed` only affects the pose,
  // so speech stays decoupled (mouth lipsyncs whether idle on the call or turned
  // to the laptop), and because we animate `progress` ourselves the turn is
  // smooth in both directions and immune to brand-package transpile staleness.
  const unity = (
    <AnimatedUnity
      antenna={antenna}
      className={cn('h-full w-full', creatureClassName)}
      accent={getCreatureAccent(color)}
      active
      disableSpeechMotion={!animateBodyMotion}
      form={form}
      emotion={mood}
      isSpeaking={isSpeaking}
      isUserSpeaking={isUserSpeaking}
      restingEyes={isHovered ? 'square' : poseRestingEyes}
      stableBox
      speechLevel={displayedSpeechLevel}
      mouthShape={displayedMouthShape}
      skin={outfit}
      fixed={progress}
      restView={CAMERA_VIEW}
      activeView={WORKING_VIEW}
    />
  );

  // When idle the wrapper is transparent to layout (`display: contents`) so the
  // droid sizes exactly as it did before; while working it becomes a positioned
  // box that anchors the laptop overlay. The anchor lift is applied to the
  // droid ONLY: it shifts every body form so the midpoint of its blank lower
  // front lands where the standard body's sits, while the laptop stays fixed in
  // slot coordinates — so the laptop reads identically against every body.
  const composed = (
    <span
      style={
        working
          ? { position: 'relative', display: 'block', width: '100%', height: '100%' }
          : { display: 'contents' }
      }
    >
      <span
        className="block h-full w-full"
        style={liftPx !== 0 ? { transform: `translateY(${liftPx}px)` } : undefined}
      >
        {unity}
      </span>
      {working && (
        <span
          aria-hidden="true"
          data-testid="unity-call-laptop"
          style={{
            ...laptopStyleForForm(form),
            opacity: laptopVisible ? 1 : 0,
            transition: LAPTOP_FADE,
          }}
        >
          <Laptop fold={1 - progress} />
        </span>
      )}
    </span>
  );

  return (
    <span
      ref={slotRef}
      className={cn('flex h-full w-full items-center justify-center overflow-visible', className)}
      aria-label={label}
      data-testid="unity-call-avatar"
      data-acting={isActing ? 'true' : 'false'}
      data-facing={turnedToLaptop ? 'laptop' : 'camera'}
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
