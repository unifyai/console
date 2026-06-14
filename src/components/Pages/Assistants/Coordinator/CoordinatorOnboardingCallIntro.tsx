'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  SeatedCoordinatorDroid,
  useCoordinatorDroidLayout,
} from '@/components/Pages/Assistants/Coordinator/SeatedCoordinatorDroid';
import {
  COORDINATOR_ONBOARDING_INTRO,
  COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID,
  COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION,
  type CoordinatorOnboardingIntroDroidAppearance,
  type CoordinatorOnboardingIntroVoice,
} from '@/utils/assistants/coordinator-onboarding-intro';
import type { CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { getDroidMouthShape } from '@/utils/assistants/droid-lipsync';
import type { PrecomputedDroidLipsyncTrack } from '@droid/brand/droid';
import type { VISEMES } from 'wawa-lipsync';

type IntroStage = 'pause' | 'speaking' | 'flying' | 'landing';

/** Resolve the pre-computed lipsync track URL for an intro audio source. */
function lipsyncUrlForAudio(src: string): string {
  return src.replace(/\.mp3(\?.*)?$/i, '.lipsync.json');
}

/**
 * Sample a pre-computed lipsync track at a playback position. Masked
 * (transition-effect) frames are authored as inactive, so this returns a still,
 * closed mouth for them — the radio crackle / tuning / bleep windows never
 * animate.
 */
function sampleIntroLipsyncTrack(
  track: PrecomputedDroidLipsyncTrack,
  currentTime: number
): { mouthShape: CreatureMouthShape; speechLevel: number } {
  const frames = track.frames;
  if (frames.length === 0) return { mouthShape: 'closed', speechLevel: 0 };
  const idx = Math.max(
    0,
    Math.min(frames.length - 1, Math.round(currentTime * Math.max(track.fps, 1)))
  );
  const [viseme, speechLevel, active] = frames[idx];
  if (active !== 1) return { mouthShape: 'closed', speechLevel: 0 };
  return {
    mouthShape: getDroidMouthShape(viseme as VISEMES, speechLevel),
    speechLevel,
  };
}
type PreludePhase =
  | 'static'
  | 'wrongVoice'
  | 'wrongLanguage'
  | 'clean'
  | 'outfitNopeA'
  | 'outfitNopeB'
  | 'outfitNotQuite'
  | 'outfitPerfect'
  | 'marty';
type BrowserWindowWithCoordinatorIntroAudio = Window & {
  __coordinatorOnboardingIntroAudio?: HTMLAudioElement;
  __coordinatorOnboardingIntroSpeechLevel?: number;
  __coordinatorOnboardingIntroMouthShape?: CreatureMouthShape;
};

interface CoordinatorOnboardingCallIntroProps {
  initialAvatarOffset: { x: number; y: number };
  initialDroid?: CoordinatorOnboardingIntroDroidAppearance;
  initialVoice?: CoordinatorOnboardingIntroVoice;
  onReadyToStartCall: () => void;
  onFinished: () => void;
}

function getRuntimeTiming() {
  if (typeof window === 'undefined') {
    return {
      durationMs: COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs,
      preludeDurationMs: COORDINATOR_ONBOARDING_INTRO.preludeDurationMs,
    };
  }

  const runtimeWindow = window as unknown as Record<string, number | undefined>;
  const runtimeDurationMs = runtimeWindow['__COORDINATOR_ONBOARDING_INTRO_DURATION_MS'];
  return {
    durationMs: runtimeDurationMs ?? COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs,
    preludeDurationMs:
      runtimeWindow['__COORDINATOR_ONBOARDING_INTRO_PRELUDE_DURATION_MS'] ??
      (runtimeDurationMs === undefined ? COORDINATOR_ONBOARDING_INTRO.preludeDurationMs : 0),
  };
}

function getAcceleratedScrollProgress(elapsedMs: number, totalMs: number, accelerationMs: number) {
  const elapsed = Math.min(elapsedMs, totalMs);
  const rampMs = Math.min(accelerationMs, totalMs);
  if (rampMs <= 0) return elapsed / totalMs;

  const denominator = totalMs - rampMs / 2;
  if (elapsed < rampMs) {
    return (elapsed * elapsed) / (2 * rampMs * denominator);
  }

  return (elapsed - rampMs / 2) / denominator;
}

function getVisualHandoffOffsetMs(durationMs: number, preludeDurationMs: number) {
  const backgroundStartOffsetMs =
    preludeDurationMs + COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs;

  return Math.max(
    backgroundStartOffsetMs + 500,
    durationMs - COORDINATOR_ONBOARDING_INTRO.handoffLeadMs
  );
}

function getBackgroundStartOffsetMs(preludeDurationMs: number) {
  return preludeDurationMs + COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs;
}

const MARTY_DROID_APPEARANCE = {
  baseEyes: 'up',
  color: 'green',
  mood: 'happy',
  shape: 'clawd',
} satisfies CoordinatorOnboardingIntroDroidAppearance;

// The same Marty, dressed up with a shirt collar + tie. The wardrobe
// rotation lands on the bare Marty ("not quite") and then the final
// whoosh slips on the formal outfit ("perfect"), so the gag pays off as
// Marty getting suited up rather than swapping for a different droid.
const MARTY_FORMAL_DROID_APPEARANCE = {
  ...MARTY_DROID_APPEARANCE,
  skin: 'shirtTie',
} satisfies CoordinatorOnboardingIntroDroidAppearance;

// Fixed "wrong" wardrobe options cycled through during the outfit
// switch. The selector row is
// [arrival droid, ...candidates, bare Marty, formal Marty], so the first
// cell is always whatever droid the user came in with and the last two
// cells are Marty without then with the collar + tie.
//
// Candidates are restricted to the two most compact forms (``wide`` and
// ``notch``): taller bodies (``sprout``/``tall``) overshoot the seated
// avatar frame and read awkwardly as they slide past, so variety comes
// from colour rather than size.
const OUTFIT_CANDIDATE_DROIDS = [
  { baseEyes: 'square', color: 'purple', mood: 'happy', shape: 'wide' },
  { baseEyes: 'up', color: 'orange', mood: 'apologetic', shape: 'notch' },
] satisfies readonly CoordinatorOnboardingIntroDroidAppearance[];

function getOutfitSelectorDroids(initialDroid: CoordinatorOnboardingIntroDroidAppearance) {
  return [
    initialDroid,
    ...OUTFIT_CANDIDATE_DROIDS,
    MARTY_DROID_APPEARANCE,
    MARTY_FORMAL_DROID_APPEARANCE,
  ] satisfies readonly CoordinatorOnboardingIntroDroidAppearance[];
}

// The selector renders for the whole prelude. The arrival droid sits in
// cell 0 (shown through the static/voice/language gag and "there we go"),
// then each whoosh advances one cell — offsets in the timing effect are
// pinned to the exact transition snippets in the audio. The penultimate
// whoosh lands on the bare Marty (cell 3, "not quite") and the final
// whoosh slips on the collar + tie (cell 4, the formal Marty), who keeps
// talking with no swap/jump.
function getOutfitSelectorIndex(phase: PreludePhase) {
  switch (phase) {
    case 'outfitNopeA':
      return 1;
    case 'outfitNopeB':
      return 2;
    case 'outfitNotQuite':
      return 3;
    case 'outfitPerfect':
    case 'marty':
      return 4;
    default:
      return 0;
  }
}

function getPreludeAvatarVisual(
  phase: PreludePhase,
  initialDroid: CoordinatorOnboardingIntroDroidAppearance
) {
  if (phase === 'marty') return MARTY_FORMAL_DROID_APPEARANCE;
  return initialDroid;
}

function OutfitSelectorDroid({
  droids,
  activeIndex,
  isSpeaking,
  mouthShape,
  speechLevel,
  droidWidth,
  framePx,
}: {
  droids: readonly CoordinatorOnboardingIntroDroidAppearance[];
  activeIndex: number;
  isSpeaking: boolean;
  mouthShape: CreatureMouthShape;
  speechLevel?: number;
  droidWidth: number;
  framePx: number;
}) {
  return (
    // Clip horizontally only: the brand droid SVG draws with
    // ``overflow: visible`` (antenna above, shadow below), so a plain
    // ``overflow-hidden`` would shear the droids' tops/bottoms. A
    // clip-path inset that hugs the left/right edges but extends far past
    // the top/bottom hides the neighbouring cells without cropping the
    // active droid — matching the un-clipped single avatar exactly.
    <div
      className="relative"
      style={{ width: framePx, height: framePx, clipPath: 'inset(-200px 0px -200px 0px)' }}
    >
      <motion.div
        animate={{ x: -activeIndex * framePx }}
        className="absolute left-0 top-0 flex"
        initial={false}
        style={{ height: framePx }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      >
        {droids.map((droid, index) => (
          <div
            className="relative shrink-0"
            key={`${index}-${droid.color}-${droid.shape}`}
            style={{ width: framePx, height: framePx }}
          >
            <SeatedCoordinatorDroid
              droid={droid}
              width={droidWidth}
              isSpeaking={isSpeaking}
              mouthShape={mouthShape}
              speechLevel={speechLevel}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function CoordinatorOnboardingCallIntro({
  initialAvatarOffset,
  initialDroid = COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID,
  initialVoice,
  onReadyToStartCall,
  onFinished,
}: CoordinatorOnboardingCallIntroProps) {
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const onReadyToStartCallRef = React.useRef(onReadyToStartCall);
  const onFinishedRef = React.useRef(onFinished);
  const hasStartedCallRef = React.useRef(false);
  const hasFinishedRef = React.useRef(false);
  const keepAudioAfterUnmountRef = React.useRef(false);
  const [stage, setStage] = React.useState<IntroStage>('pause');
  const [preludePhase, setPreludePhase] = React.useState<PreludePhase>('static');
  const [audioSpeechLevel, setAudioSpeechLevel] = React.useState(0);
  const [audioMouthShape, setAudioMouthShape] = React.useState<CreatureMouthShape>('closed');
  const configuredIntroAudioSrc = initialVoice?.audioSrc ?? COORDINATOR_ONBOARDING_INTRO.audioSrc;
  // Pre-computed lipsync track for the intro audio (same offline flow as the
  // landing page). The mouth is sampled from this by playback time rather than
  // analysed live, which keeps it deterministic and lets us mask the radio
  // transition windows so the mouth is still during them.
  const lipsyncTrackRef = React.useRef<PrecomputedDroidLipsyncTrack | null>(null);

  React.useEffect(() => {
    onReadyToStartCallRef.current = onReadyToStartCall;
    onFinishedRef.current = onFinished;
  }, [onFinished, onReadyToStartCall]);

  React.useEffect(() => {
    if (!configuredIntroAudioSrc) return undefined;
    let cancelled = false;
    fetch(lipsyncUrlForAudio(configuredIntroAudioSrc), { cache: 'no-cache' })
      .then((res) => (res.ok ? (res.json() as Promise<PrecomputedDroidLipsyncTrack>) : null))
      .then((track) => {
        if (!cancelled) lipsyncTrackRef.current = track;
      })
      .catch(() => {
        if (!cancelled) lipsyncTrackRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [configuredIntroAudioSrc]);

  const startCallOnce = React.useCallback(() => {
    if (hasStartedCallRef.current) return;
    hasStartedCallRef.current = true;
    onReadyToStartCallRef.current();
  }, []);

  const finishOnce = React.useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    keepAudioAfterUnmountRef.current = true;
    startCallOnce();
    onFinishedRef.current();
  }, [startCallOnce]);

  React.useEffect(() => {
    // Offsets are milliseconds into the intro audio (playback begins at
    // ``initialPauseMs``, the same anchor these timers use). Each outfit
    // offset is pinned to the exact start of its tuning-whoosh snippet in
    // the prelude track so the selector slide lands on the transition
    // sound. Derived from the concatenated segment durations:
    //   there-we-go 10.999s | whoosh1 15.282s | whoosh2 16.352s
    //   whoosh3 17.237s | whoosh4 18.400s | "Hi, I'm Marty" 19.690s
    const phases: Array<[PreludePhase, number]> = [
      ['wrongVoice', 4_551],
      ['wrongLanguage', 8_716],
      ['clean', 10_999],
      ['outfitNopeA', 15_282],
      ['outfitNopeB', 16_352],
      ['outfitNotQuite', 17_237],
      ['outfitPerfect', 18_400],
      ['marty', 19_690],
    ];
    const timers = phases.map(([phase, offsetMs]) =>
      window.setTimeout(
        () => setPreludePhase(phase),
        COORDINATOR_ONBOARDING_INTRO.initialPauseMs + offsetMs
      )
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  React.useEffect(() => {
    const { durationMs, preludeDurationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs, preludeDurationMs);
    const backgroundStartOffsetMs = getBackgroundStartOffsetMs(preludeDurationMs);
    const speakingStartTimer = window.setTimeout(
      () => setStage('speaking'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );
    const backgroundStartTimer = window.setTimeout(
      () => setStage((currentStage) => (currentStage === 'speaking' ? 'flying' : currentStage)),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + backgroundStartOffsetMs
    );
    const callWarmupTimer = window.setTimeout(
      () => startCallOnce(),
      COORDINATOR_ONBOARDING_INTRO.callWarmupDelayMs
    );
    const landingTimer = window.setTimeout(
      () => setStage('landing'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + handoffOffsetMs
    );
    let audio: HTMLAudioElement | null = null;
    let audioTimer: number | null = null;
    let animationFrame = 0;
    let hasStartedAudio = false;
    let shouldPublishToComponent = true;

    const stopAudioAnalysis = (resetSpeechLevel = true) => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
      coordinatorWindow.__coordinatorOnboardingIntroSpeechLevel = 0;
      coordinatorWindow.__coordinatorOnboardingIntroMouthShape = 'closed';
      if (resetSpeechLevel) {
        setAudioSpeechLevel(0);
        setAudioMouthShape('closed');
      }
    };

    // Drive the mouth from the pre-computed track by playback position. No live
    // analyser is constructed; masked transition windows resolve to a still,
    // closed mouth.
    const startAudioAnalysis = (audioElement: HTMLAudioElement) => {
      const tick = () => {
        const track = lipsyncTrackRef.current;
        const { mouthShape, speechLevel } = track
          ? sampleIntroLipsyncTrack(track, audioElement.currentTime)
          : { mouthShape: 'closed' as CreatureMouthShape, speechLevel: 0 };
        const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
        coordinatorWindow.__coordinatorOnboardingIntroSpeechLevel = speechLevel;
        coordinatorWindow.__coordinatorOnboardingIntroMouthShape = mouthShape;
        if (shouldPublishToComponent) {
          setAudioSpeechLevel(speechLevel);
          setAudioMouthShape(mouthShape);
        }
        animationFrame = window.requestAnimationFrame(tick);
      };

      animationFrame = window.requestAnimationFrame(tick);
    };

    if (configuredIntroAudioSrc) {
      audio = new Audio(configuredIntroAudioSrc);
      audio.preload = 'auto';
      audio.loop = false;
      audioTimer = window.setTimeout(() => {
        if (!audio) return;
        if (hasStartedAudio) return;
        hasStartedAudio = true;

        const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
        const previousAudio = coordinatorWindow.__coordinatorOnboardingIntroAudio;
        if (previousAudio && previousAudio !== audio) {
          previousAudio.pause();
          previousAudio.currentTime = 0;
          previousAudio.removeAttribute('src');
          previousAudio.load();
        }
        coordinatorWindow.__coordinatorOnboardingIntroAudio = audio;

        startAudioAnalysis(audio);
        audio.play().catch(() => {
          stopAudioAnalysis();
        });
      }, COORDINATOR_ONBOARDING_INTRO.initialPauseMs);
      audio.addEventListener(
        'ended',
        () => {
          const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
          if (coordinatorWindow.__coordinatorOnboardingIntroAudio === audio) {
            coordinatorWindow.__coordinatorOnboardingIntroAudio = undefined;
          }
          stopAudioAnalysis(!hasFinishedRef.current);
          if (!hasFinishedRef.current) {
            setStage('landing');
          }
        },
        { once: true }
      );
    }

    return () => {
      window.clearTimeout(speakingStartTimer);
      window.clearTimeout(backgroundStartTimer);
      window.clearTimeout(callWarmupTimer);
      window.clearTimeout(landingTimer);
      if (audioTimer !== null) window.clearTimeout(audioTimer);
      const keepAudioPlaying = keepAudioAfterUnmountRef.current && !!audio && !audio.ended;
      shouldPublishToComponent = false;
      if (!keepAudioPlaying) {
        stopAudioAnalysis();
      }
      if (audio) {
        const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
        if (!keepAudioPlaying && coordinatorWindow.__coordinatorOnboardingIntroAudio === audio) {
          coordinatorWindow.__coordinatorOnboardingIntroAudio = undefined;
        }
        if (!keepAudioPlaying) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    };
  }, [configuredIntroAudioSrc, startCallOnce]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'flying') return;

    const { durationMs, preludeDurationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs, preludeDurationMs);
    const backgroundStartOffsetMs = getBackgroundStartOffsetMs(preludeDurationMs);
    const motionDurationMs = Math.max(1, handoffOffsetMs - backgroundStartOffsetMs);
    let startTimestamp: number | null = null;
    let animationFrame = 0;

    // Ascend the city image: progress 0 → 1 maps to a
    // ``background-position-y`` of 100% → 0%, so the scroll begins at
    // the bottom of the image and rises to its top (like riding an
    // elevator up) exactly as the flying window closes into the call
    // handoff.
    const tick = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = getAcceleratedScrollProgress(
        timestamp - startTimestamp,
        motionDurationMs,
        COORDINATOR_ONBOARDING_INTRO.backgroundAccelerationMs
      );
      root.style.setProperty('--coordinator-intro-city-position', `${(1 - progress) * 100}%`);
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [stage]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'landing') return;

    // Settle on the top of the city image and hold it there through
    // the handoff rather than snapping back to the bottom.
    root.style.setProperty('--coordinator-intro-city-position', '0%');
    const handle = window.setTimeout(() => {
      finishOnce();
    }, COORDINATOR_ONBOARDING_INTRO.landingDurationMs);

    return () => window.clearTimeout(handle);
  }, [finishOnce, stage]);

  const preludeAvatarVisual = getPreludeAvatarVisual(preludePhase, initialDroid);
  // The whole prelude rides the wardrobe selector so the droid that finally
  // "arrives" (Marty, cell 4) is the very same element that keeps talking —
  // no swap to a separate avatar, hence no positional jump. The single
  // avatar (with the call-handoff ``layoutId``) only takes over once the
  // background starts scrolling (``flying``/``landing``).
  const isPreludeVisible = stage === 'pause' || stage === 'speaking';
  const showOutfitSelector = isPreludeVisible;
  const outfitSelectorDroids = getOutfitSelectorDroids(initialDroid);
  const activeOutfitIndex = getOutfitSelectorIndex(preludePhase);

  return (
    <div
      ref={rootRef}
      className="brand-page-stencil-bg coordinator-onboarding-city-bg flex h-full w-full items-center justify-center overflow-hidden bg-background"
      data-background-motion={
        stage === 'flying' ? 'scrolling' : stage === 'landing' ? 'landing' : 'idle'
      }
      data-prelude-phase={isPreludeVisible ? preludePhase : undefined}
      data-initial-voice={initialVoice?.id}
      data-testid="coordinator-onboarding-call-intro"
    >
      <motion.div
        initial={{ opacity: 1, x: initialAvatarOffset.x, y: initialAvatarOffset.y, scale: 1 }}
        animate={{
          opacity: 1,
          x: initialAvatarOffset.x,
          y: initialAvatarOffset.y,
          scale: 1,
        }}
        exit={{ opacity: 1, x: initialAvatarOffset.x, y: initialAvatarOffset.y, scale: 1 }}
        transition={{ duration: isPreludeVisible ? 0.28 : 0 }}
        className="flex items-center justify-center"
      >
        <div className="relative" style={{ width: framePx, height: framePx }}>
          {showOutfitSelector ? (
            <OutfitSelectorDroid
              droids={outfitSelectorDroids}
              activeIndex={activeOutfitIndex}
              isSpeaking={stage === 'speaking'}
              mouthShape={audioMouthShape}
              speechLevel={configuredIntroAudioSrc ? audioSpeechLevel : undefined}
              droidWidth={droidWidth}
              framePx={framePx}
            />
          ) : (
            // ``layoutId`` lives on a stable, full-box wrapper (no transform of
            // its own) so the shared-element morph into the docked call avatar
            // animates cleanly; the seated droid inside keeps the same baseline
            // as the selector's final Marty cell, so there's no jump on swap.
            <motion.span
              className="absolute inset-0 block"
              layoutId="coordinator-onboarding-call-avatar"
              transition={COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION}
            >
              <SeatedCoordinatorDroid
                droid={preludeAvatarVisual}
                width={droidWidth}
                isSpeaking={stage === 'flying' || stage === 'landing'}
                mouthShape={audioMouthShape}
                speechLevel={configuredIntroAudioSrc ? audioSpeechLevel : undefined}
              />
            </motion.span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
