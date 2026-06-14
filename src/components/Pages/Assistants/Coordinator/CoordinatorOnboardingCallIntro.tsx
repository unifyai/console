'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { AnimatedDroidFaceState } from '@droid/brand/components';
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
type CoordinatorCitySoundscapeState = {
  bedNodes: AudioScheduledSourceNode[];
  context: AudioContext;
  eventTimer: number | null;
  latestVolume: number;
  masterGain: GainNode;
};

// Playback position (seconds) of Marty's closing line — "Any immediate
// questions before we start?" — the final continuous utterance in the
// intro audio (everything after ~59.3s, derived via silence detection).
// "Skip" seeks here so the intro lands on the question instead of dead air.
const SKIP_AUDIO_TARGET_SEC = 59.2;
// When skipping, the elevator ascent is compressed to a quick rise so the
// droid reaches his call position in step with the seeked-to closing line.
const SKIP_FLY_MS = 1_400;
const CITY_SOUNDSCAPE_MAX_VOLUME = 0.18;
const CITY_SOUNDSCAPE_AUDIBILITY_FLOOR = 0.006;
const CITY_SOUNDSCAPE_FADE_IN_MS = 2_500;
let coordinatorCitySoundscapeState: CoordinatorCitySoundscapeState | null = null;
let coordinatorCitySoundscapeCleanupTimer: number | null = null;

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function createBrownNoiseSource(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;

  for (let i = 0; i < data.length; i += 1) {
    last = (last + (Math.random() * 2 - 1) * 0.035) * 0.985;
    data[i] = last * 2.5;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function connectCityBed(context: AudioContext, destination: AudioNode) {
  const bedNodes: AudioScheduledSourceNode[] = [];
  const humMix = context.createGain();
  const humFilter = context.createBiquadFilter();
  const airSource = createBrownNoiseSource(context);
  const airFilter = context.createBiquadFilter();
  const airGain = context.createGain();

  humMix.gain.value = 0.032;
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 260;
  humFilter.Q.value = 0.7;

  [49, 73.5, 98].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = (index - 1) * 5;
    oscillator.connect(humMix);
    oscillator.start();
    bedNodes.push(oscillator);
  });

  airFilter.type = 'bandpass';
  airFilter.frequency.value = 420;
  airFilter.Q.value = 0.45;
  airGain.gain.value = 0.04;

  humMix.connect(humFilter);
  humFilter.connect(destination);
  airSource.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(destination);
  airSource.start();
  bedNodes.push(airSource);

  return bedNodes;
}

function connectWithOptionalPan(
  context: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  pan: number
) {
  if (!('createStereoPanner' in context)) {
    source.connect(destination);
    return;
  }

  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  source.connect(panner);
  panner.connect(destination);
}

function playCityWhoosh(state: CoordinatorCitySoundscapeState) {
  const { context, masterGain } = state;
  const now = context.currentTime;
  const source = createBrownNoiseSource(context);
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const duration = 1.2 + Math.random() * 1.1;
  const startFreq = 180 + Math.random() * 260;
  const endFreq = 560 + Math.random() * 620;
  const pan = Math.random() > 0.5 ? -0.75 : 0.75;

  filter.type = 'bandpass';
  filter.Q.value = 1.8;
  filter.frequency.setValueAtTime(startFreq, now);
  filter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34 + Math.random() * 0.1, now + duration * 0.22);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  connectWithOptionalPan(context, gain, masterGain, pan);
  source.start(now);
  source.stop(now + duration + 0.02);
}

function stopCitySoundscapeEvents(state = coordinatorCitySoundscapeState) {
  if (!state || state.eventTimer === null) return;
  window.clearTimeout(state.eventTimer);
  state.eventTimer = null;
}

function scheduleCitySoundscapeEvents(state: CoordinatorCitySoundscapeState) {
  if (state.eventTimer !== null || state.latestVolume < CITY_SOUNDSCAPE_AUDIBILITY_FLOOR) return;

  state.eventTimer = window.setTimeout(
    () => {
      state.eventTimer = null;
      if (coordinatorCitySoundscapeState !== state) return;
      if (
        !document.hidden &&
        state.context.state === 'running' &&
        state.latestVolume >= CITY_SOUNDSCAPE_AUDIBILITY_FLOOR
      ) {
        playCityWhoosh(state);
        scheduleCitySoundscapeEvents(state);
      }
    },
    850 + Math.random() * 1_700
  );
}

function ensureCoordinatorCitySoundscape() {
  if (coordinatorCitySoundscapeCleanupTimer !== null) {
    window.clearTimeout(coordinatorCitySoundscapeCleanupTimer);
    coordinatorCitySoundscapeCleanupTimer = null;
  }
  if (coordinatorCitySoundscapeState) return coordinatorCitySoundscapeState;

  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) return null;

  const context = new AudioContextCtor();
  const masterGain = context.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(context.destination);

  const bedNodes = connectCityBed(context, masterGain);
  coordinatorCitySoundscapeState = {
    bedNodes,
    context,
    eventTimer: null,
    latestVolume: 0,
    masterGain,
  };
  return coordinatorCitySoundscapeState;
}

function setCoordinatorCitySoundscapeVolume(volume: number) {
  const state = ensureCoordinatorCitySoundscape();
  if (!state) return;

  state.latestVolume = volume;
  const now = state.context.currentTime;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.setTargetAtTime(volume, now, 0.16);

  if (volume >= CITY_SOUNDSCAPE_AUDIBILITY_FLOOR) {
    void state.context.resume();
    scheduleCitySoundscapeEvents(state);
  } else {
    stopCitySoundscapeEvents(state);
  }
}

function cleanupCoordinatorCitySoundscape() {
  const state = coordinatorCitySoundscapeState;
  if (!state) return;

  stopCitySoundscapeEvents(state);
  state.latestVolume = 0;
  const now = state.context.currentTime;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.setTargetAtTime(0, now, 0.12);

  if (coordinatorCitySoundscapeCleanupTimer !== null) {
    window.clearTimeout(coordinatorCitySoundscapeCleanupTimer);
  }
  coordinatorCitySoundscapeCleanupTimer = window.setTimeout(() => {
    if (coordinatorCitySoundscapeState !== state) return;
    state.bedNodes.forEach((node) => node.stop());
    void state.context.close();
    coordinatorCitySoundscapeState = null;
    coordinatorCitySoundscapeCleanupTimer = null;
  }, 1_800);
}

export function primeCoordinatorOnboardingCitySoundscape() {
  const state = ensureCoordinatorCitySoundscape();
  if (!state) return;

  state.masterGain.gain.setValueAtTime(0, state.context.currentTime);
  void state.context.resume();
}

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
  skipSignal?: number;
  onSkipped?: () => void;
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

function getCityBackdropOpacity(progress: number) {
  const fadeStart = 0.74;
  const fadeEnd = 0.96;
  const fadeProgress = Math.max(0, Math.min(1, (progress - fadeStart) / (fadeEnd - fadeStart)));
  return 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
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
const OUTFIT_SELECTOR_VISIBLE_WIDTH_RATIO = 0.76;

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

/**
 * Deterministic face for the voice-tuning portion of the prelude — before
 * Marty lands a clean voice at the ``clean`` ("there we go") beat.
 *
 * The brow stays raised the whole way through and flips to its mirror on each
 * fresh tuning attempt, so the otherwise-static face keeps moving between
 * whooshes. The mouth tells the story of the gag: the very first utterance
 * (``static``) still rides the normal smiling lipsync because Marty thinks the
 * voice is fine, then flattens to a talking bar from the first wrong attempt
 * onward until the voice is sorted. Returning ``null`` (``clean`` and the
 * outfit beats) hands the face back to the default mood-driven animation.
 */
function getPreludeFaceOverride(
  phase: PreludePhase,
  isSpeaking: boolean,
  mouthShape: CreatureMouthShape,
  speechLevel: number
): AnimatedDroidFaceState | null {
  const base = {
    mouthLevel: speechLevel,
    speechActive: isSpeaking,
    speechLevel,
  };
  switch (phase) {
    case 'static':
      // First utterance: raised brow, but still the smiling lipsync mouth.
      return { ...base, eyeDir: 'skeptical', mouth: mouthShape, mouthRect: false };
    case 'wrongVoice':
      // First wrong attempt: brow mirrors, mouth flattens to a talking bar.
      return { ...base, eyeDir: 'skepticalMirror', mouth: 'flat', mouthRect: true };
    case 'wrongLanguage':
      // Second attempt: brow flips back, mouth stays flat.
      return { ...base, eyeDir: 'skeptical', mouth: 'flat', mouthRect: true };
    default:
      return null;
  }
}

function OutfitSelectorDroid({
  droids,
  activeIndex,
  isSpeaking,
  mouthShape,
  speechLevel,
  faceState,
  droidWidth,
  framePx,
}: {
  droids: readonly CoordinatorOnboardingIntroDroidAppearance[];
  activeIndex: number;
  isSpeaking: boolean;
  mouthShape: CreatureMouthShape;
  speechLevel?: number;
  faceState?: AnimatedDroidFaceState | null;
  droidWidth: number;
  framePx: number;
}) {
  const visibleWidthPx = droidWidth * OUTFIT_SELECTOR_VISIBLE_WIDTH_RATIO;
  const horizontalClipPx = Math.max(0, (framePx - visibleWidthPx) / 2);

  return (
    // Clip to the visible body aperture only: the brand droid SVG draws with
    // extra horizontal box space plus vertical overflow (antenna above, shadow
    // below), so the mask is narrower than the render width but vertically open.
    <div
      className="relative"
      style={{
        width: framePx,
        height: framePx,
        clipPath: `inset(-200px ${horizontalClipPx}px -200px ${horizontalClipPx}px)`,
      }}
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
              faceState={faceState}
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
  skipSignal = 0,
  onSkipped,
}: CoordinatorOnboardingCallIntroProps) {
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const onReadyToStartCallRef = React.useRef(onReadyToStartCall);
  const onFinishedRef = React.useRef(onFinished);
  const onSkippedRef = React.useRef(onSkipped);
  const hasStartedCallRef = React.useRef(false);
  const hasFinishedRef = React.useRef(false);
  const keepAudioAfterUnmountRef = React.useRef(false);
  // Set when "Skip" is pressed before the audio element has begun playing
  // (within the opening pause); the start handler then seeks immediately.
  const skipRequestedRef = React.useRef(false);
  const previousSkipSignalRef = React.useRef(skipSignal);
  const [stage, setStage] = React.useState<IntroStage>('pause');
  const [skipped, setSkipped] = React.useState(false);
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
    onSkippedRef.current = onSkipped;
  }, [onFinished, onReadyToStartCall, onSkipped]);

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

  // Skip the bulk of the monologue: seek the audio to Marty's closing
  // question and float the suited-up droid into his call position on a
  // compressed ascent. When the seeked line ends, the existing ``ended``
  // handler lands and hands off to the call as a natural finish would.
  const skipToClosingQuestion = React.useCallback(() => {
    if (hasFinishedRef.current || stage === 'landing') return;
    skipRequestedRef.current = true;
    // Retire the top-centre "Intro" countdown — it's no longer meaningful
    // once we've jumped to the closing line.
    onSkippedRef.current?.();
    const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
    const audio = coordinatorWindow.__coordinatorOnboardingIntroAudio;
    if (audio) {
      const ceiling = (audio.duration || SKIP_AUDIO_TARGET_SEC + 2) - 0.05;
      audio.currentTime = Math.max(0, Math.min(SKIP_AUDIO_TARGET_SEC, ceiling));
      void audio.play().catch(() => undefined);
    }
    setPreludePhase('marty');
    // From the seated speaking beats, kick off the compressed ascent into
    // the call position. If we're already flying, leave the in-flight
    // ascent untouched and just let the seeked-to line carry us to landing.
    if (stage === 'pause' || stage === 'speaking') {
      setSkipped(true);
      setStage('flying');
    }
  }, [stage]);

  React.useEffect(() => {
    if (skipSignal === previousSkipSignalRef.current) return;
    previousSkipSignalRef.current = skipSignal;
    if (skipSignal === 0) return;
    skipToClosingQuestion();
  }, [skipSignal, skipToClosingQuestion]);

  React.useEffect(() => {
    return () => {
      cleanupCoordinatorCitySoundscape();
    };
  }, []);

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

        // Honour a skip that landed before playback began.
        if (skipRequestedRef.current) {
          const ceiling = (audio.duration || SKIP_AUDIO_TARGET_SEC + 2) - 0.05;
          audio.currentTime = Math.max(0, Math.min(SKIP_AUDIO_TARGET_SEC, ceiling));
        }
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
    if (!root) return;

    const { durationMs, preludeDurationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs, preludeDurationMs);
    const motionDurationMs = skipped
      ? SKIP_FLY_MS
      : Math.max(1, COORDINATOR_ONBOARDING_INTRO.initialPauseMs + handoffOffsetMs);
    const currentPosition = Number.parseFloat(
      root.style.getPropertyValue('--coordinator-intro-city-position')
    );
    const startPosition = skipped
      ? Number.isFinite(currentPosition)
        ? currentPosition
        : 100
      : 100;
    let startTimestamp: number | null = null;
    let animationFrame = 0;

    const tick = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const elapsedMs = timestamp - startTimestamp;
      const progress = getAcceleratedScrollProgress(
        elapsedMs,
        motionDurationMs,
        COORDINATOR_ONBOARDING_INTRO.backgroundAccelerationMs
      );
      const position = skipped ? startPosition * (1 - progress) : (1 - progress) * 100;
      const ascentProgress = 1 - position / 100;
      const cityOpacity = getCityBackdropOpacity(ascentProgress);
      const soundFadeIn = skipped ? 1 : Math.min(1, elapsedMs / CITY_SOUNDSCAPE_FADE_IN_MS);
      root.style.setProperty('--coordinator-intro-city-position', `${position}%`);
      root.style.setProperty('--coordinator-intro-city-opacity', cityOpacity.toString());
      setCoordinatorCitySoundscapeVolume(CITY_SOUNDSCAPE_MAX_VOLUME * cityOpacity * soundFadeIn);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [skipped]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'landing') return;

    root.style.setProperty('--coordinator-intro-city-position', '0%');
    root.style.setProperty('--coordinator-intro-city-opacity', '0');
    setCoordinatorCitySoundscapeVolume(0);
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
  // Pin the raised-brow + flat-mouth face through the voice-tuning beats; the
  // outfit phases (and ``clean`` onward) fall back to the default animation.
  const preludeFaceOverride = getPreludeFaceOverride(
    preludePhase,
    stage === 'speaking',
    audioMouthShape,
    configuredIntroAudioSrc ? audioSpeechLevel : 0
  );

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
              faceState={preludeFaceOverride}
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
