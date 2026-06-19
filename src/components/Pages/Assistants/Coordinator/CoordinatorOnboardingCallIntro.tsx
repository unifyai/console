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
  COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT,
} from '@/utils/assistants/coordinator-onboarding-intro';
import { DroidTeleportFizzle } from '@/components/Pages/Assistants/Communication/DroidTeleportFizzle';
import type { CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { getDroidMouthShape } from '@/utils/assistants/droid-lipsync';
import type { PrecomputedDroidLipsyncTrack } from '@droid/brand/droid';
import type { VISEMES } from 'wawa-lipsync';
import { cn } from '@/lib/utils';

type IntroStage = 'pause' | 'speaking' | 'flying' | 'landing';
type CoordinatorCitySoundscapeState = {
  ascentBufferPromise: Promise<AudioBuffer> | null;
  ascentGain: GainNode;
  ascentSource: AudioBufferSourceNode | null;
  cityBufferPromise: Promise<AudioBuffer> | null;
  citySource: AudioBufferSourceNode | null;
  context: AudioContext;
  latestVolume: number;
  masterGain: GainNode;
};
type CoordinatorIntroBackgroundMusicState = {
  audio: HTMLAudioElement;
  src: string;
};

// When skipping, the elevator ascent is compressed to a quick rise so the
// droid reaches his call position in step with the seeked-to closing line.
const SKIP_FLY_MS = 1_400;
const CITY_SOUNDSCAPE_MAX_VOLUME = 0.4;
const CITY_SOUNDSCAPE_FADE_IN_MS = 2_500;
const ASCENT_SOUND_VOLUME = 0.27;
const ASCENT_SOUND_SKIP_OFFSET_SEC = 32;
let coordinatorCitySoundscapeState: CoordinatorCitySoundscapeState | null = null;
let coordinatorCitySoundscapeCleanupTimer: number | null = null;
let coordinatorIntroBackgroundMusicState: CoordinatorIntroBackgroundMusicState | null = null;

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function clampAudioVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

export function startCoordinatorOnboardingBackgroundMusic() {
  if (typeof window === 'undefined') return;
  const { backgroundMusicSrc, backgroundMusicVolume } = COORDINATOR_ONBOARDING_INTRO;
  if (!backgroundMusicSrc) return;

  let state = coordinatorIntroBackgroundMusicState;
  if (!state || state.src !== backgroundMusicSrc) {
    if (state) {
      state.audio.pause();
      state.audio.removeAttribute('src');
      state.audio.load();
    }
    const audio = new Audio(backgroundMusicSrc);
    audio.loop = true;
    audio.preload = 'auto';
    state = { audio, src: backgroundMusicSrc };
    coordinatorIntroBackgroundMusicState = state;
  }

  state.audio.volume = clampAudioVolume(backgroundMusicVolume);
  void state.audio.play().catch(() => undefined);
}

function setCoordinatorOnboardingBackgroundMusicVolume(volume: number) {
  const state = coordinatorIntroBackgroundMusicState;
  if (!state) return;
  state.audio.volume = clampAudioVolume(volume);
}

export function stopCoordinatorOnboardingBackgroundMusic() {
  const state = coordinatorIntroBackgroundMusicState;
  if (!state) return;

  state.audio.pause();
  state.audio.currentTime = 0;
  state.audio.removeAttribute('src');
  state.audio.load();
  coordinatorIntroBackgroundMusicState = null;
}

function loadCoordinatorCitySoundBuffer(state: CoordinatorCitySoundscapeState, src: string) {
  if (!state.cityBufferPromise) {
    state.cityBufferPromise = fetch(src, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load city ambience: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => state.context.decodeAudioData(buffer));
  }
  return state.cityBufferPromise;
}

function stopCoordinatorCityAmbience(state = coordinatorCitySoundscapeState) {
  if (!state || !state.citySource) return;
  state.citySource.stop();
  state.citySource = null;
}

// Plays the city ambience clip from its start into ``masterGain``. The fade in
// and out across the ascent is driven separately by
// ``setCoordinatorCitySoundscapeVolume`` ramping ``masterGain``.
function playCoordinatorCityAmbience(src: string) {
  const state = ensureCoordinatorCitySoundscape();
  if (!state) return;

  void state.context.resume();
  void loadCoordinatorCitySoundBuffer(state, src)
    .then((buffer) => {
      if (coordinatorCitySoundscapeState !== state) return;
      stopCoordinatorCityAmbience(state);

      const source = state.context.createBufferSource();
      source.buffer = buffer;
      source.connect(state.masterGain);
      state.citySource = source;
      source.start(state.context.currentTime);
      source.onended = () => {
        if (state.citySource === source) state.citySource = null;
      };
    })
    .catch(() => {
      state.cityBufferPromise = null;
    });
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
  const ascentGain = context.createGain();
  masterGain.gain.value = 0;
  ascentGain.gain.value = 0;
  masterGain.connect(context.destination);
  ascentGain.connect(context.destination);

  coordinatorCitySoundscapeState = {
    ascentBufferPromise: null,
    ascentGain,
    ascentSource: null,
    cityBufferPromise: null,
    citySource: null,
    context,
    latestVolume: 0,
    masterGain,
  };
  return coordinatorCitySoundscapeState;
}

function loadCoordinatorAscentSoundBuffer(state: CoordinatorCitySoundscapeState, src: string) {
  if (!state.ascentBufferPromise) {
    state.ascentBufferPromise = fetch(src, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ascent sound: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => state.context.decodeAudioData(buffer));
  }
  return state.ascentBufferPromise;
}

function stopCoordinatorAscentSound(state = coordinatorCitySoundscapeState) {
  if (!state) return;

  const now = state.context.currentTime;
  state.ascentGain.gain.cancelScheduledValues(now);
  state.ascentGain.gain.setTargetAtTime(0, now, 0.08);
  if (state.ascentSource) {
    state.ascentSource.stop(now + 0.18);
    state.ascentSource = null;
  }
}

function playCoordinatorAscentSound(src: string, skipped: boolean) {
  const state = ensureCoordinatorCitySoundscape();
  if (!state) return;

  void state.context.resume();
  void loadCoordinatorAscentSoundBuffer(state, src)
    .then((buffer) => {
      if (coordinatorCitySoundscapeState !== state) return;
      stopCoordinatorAscentSound(state);

      const now = state.context.currentTime;
      const source = state.context.createBufferSource();
      source.buffer = buffer;
      source.connect(state.ascentGain);
      state.ascentSource = source;

      state.ascentGain.gain.cancelScheduledValues(now);
      state.ascentGain.gain.setValueAtTime(0.0001, now);
      state.ascentGain.gain.exponentialRampToValueAtTime(ASCENT_SOUND_VOLUME, now + 0.75);
      state.ascentGain.gain.setValueAtTime(ASCENT_SOUND_VOLUME, now + 0.76);
      const offset = skipped
        ? Math.min(ASCENT_SOUND_SKIP_OFFSET_SEC, Math.max(0, buffer.duration - 0.5))
        : 0;
      source.start(now, offset);
      source.onended = () => {
        if (state.ascentSource === source) state.ascentSource = null;
      };
    })
    .catch(() => {
      state.ascentBufferPromise = null;
    });
}

function setCoordinatorCitySoundscapeVolume(volume: number) {
  const state = ensureCoordinatorCitySoundscape();
  if (!state) return;

  state.latestVolume = volume;
  const now = state.context.currentTime;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.setTargetAtTime(volume, now, 0.16);

  if (volume > 0) void state.context.resume();
}

function cleanupCoordinatorCitySoundscape() {
  const state = coordinatorCitySoundscapeState;
  if (!state) return;

  stopCoordinatorAscentSound(state);
  stopCoordinatorCityAmbience(state);
  state.latestVolume = 0;
  const now = state.context.currentTime;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.setTargetAtTime(0, now, 0.12);

  if (coordinatorCitySoundscapeCleanupTimer !== null) {
    window.clearTimeout(coordinatorCitySoundscapeCleanupTimer);
  }
  coordinatorCitySoundscapeCleanupTimer = window.setTimeout(() => {
    if (coordinatorCitySoundscapeState !== state) return;
    void state.context.close();
    coordinatorCitySoundscapeState = null;
    coordinatorCitySoundscapeCleanupTimer = null;
  }, 1_800);
}

export function primeCoordinatorOnboardingCitySoundscape() {
  const state = ensureCoordinatorCitySoundscape();
  if (!state) return;

  state.masterGain.gain.setValueAtTime(0, state.context.currentTime);
  void loadCoordinatorAscentSoundBuffer(state, COORDINATOR_ONBOARDING_INTRO.ascentAudioSrc).catch(
    () => {
      state.ascentBufferPromise = null;
    }
  );
  void loadCoordinatorCitySoundBuffer(state, COORDINATOR_ONBOARDING_INTRO.cityAmbienceSrc).catch(
    () => {
      state.cityBufferPromise = null;
    }
  );
  void state.context.resume();
}

/** Resolve the pre-computed lipsync track URL for an intro audio source. */
function lipsyncUrlForAudio(src: string): string {
  return src.replace(/\.mp3(\?.*)?$/i, '.lipsync.json');
}

/**
 * Sample a pre-computed lipsync track at a playback position. Inactive frames
 * resolve to a still, closed mouth so silence never flaps the droid mouth.
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
type BrowserWindowWithCoordinatorIntroAudio = Window & {
  __coordinatorOnboardingIntroAudio?: HTMLAudioElement;
  __coordinatorOnboardingIntroSpeechLevel?: number;
  __coordinatorOnboardingIntroMouthShape?: CreatureMouthShape;
};

interface CoordinatorOnboardingCallIntroProps {
  initialAvatarOffset: { x: number; y: number };
  timelineEnabled?: boolean;
  presentationMode?: 'voice' | 'text';
  onReadyToRevealSurface?: () => void;
  onFinished: () => void;
  skipSignal?: number;
  onSkipped?: () => void;
  surfaceVisible?: boolean;
  controlOverlay?: React.ReactNode;
}

function getRuntimeTiming() {
  if (typeof window === 'undefined') {
    return {
      durationMs: COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs,
    };
  }

  const runtimeWindow = window as unknown as Record<string, number | undefined>;
  const runtimeDurationMs = runtimeWindow['__COORDINATOR_ONBOARDING_INTRO_DURATION_MS'];
  return {
    durationMs: runtimeDurationMs ?? COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs,
  };
}

function getPlayableAudioTime(audio: HTMLAudioElement, targetSec: number) {
  const duration = Number.isFinite(audio.duration) ? audio.duration : targetSec + 2;
  return Math.max(0, Math.min(targetSec, duration - 0.05));
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

function getVisualHandoffOffsetMs(durationMs: number) {
  return Math.max(
    COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs + 500,
    durationMs - COORDINATOR_ONBOARDING_INTRO.handoffLeadMs
  );
}

function getSurfaceRevealOffsetMs(durationMs: number) {
  return Math.max(
    COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs + 500,
    durationMs - COORDINATOR_ONBOARDING_INTRO.surfaceRevealLeadMs
  );
}

const MARTY_DROID_APPEARANCE = COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID;
const MARTY_TEXT_BUBBLE_LINES = COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT.split('\n').filter(
  (line) => line.trim().length > 0
);

export function CoordinatorOnboardingCallIntro({
  initialAvatarOffset,
  timelineEnabled = true,
  presentationMode = 'voice',
  onReadyToRevealSurface,
  onFinished,
  skipSignal = 0,
  onSkipped,
  surfaceVisible = false,
  controlOverlay,
}: CoordinatorOnboardingCallIntroProps) {
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const onReadyToRevealSurfaceRef = React.useRef(onReadyToRevealSurface);
  const onFinishedRef = React.useRef(onFinished);
  const onSkippedRef = React.useRef(onSkipped);
  const hasFinishedRef = React.useRef(false);
  const keepAudioAfterUnmountRef = React.useRef(false);
  // Set when "Skip" is pressed before the audio element has begun playing; the
  // start handler then seeks immediately.
  const skipRequestedRef = React.useRef(false);
  const previousSkipSignalRef = React.useRef(skipSignal);
  const [stage, setStage] = React.useState<IntroStage>('pause');
  const [skipped, setSkipped] = React.useState(false);
  const [audioSpeechLevel, setAudioSpeechLevel] = React.useState(0);
  const [audioMouthShape, setAudioMouthShape] = React.useState<CreatureMouthShape>('closed');
  const [textBubbleIndex, setTextBubbleIndex] = React.useState(-1);
  const configuredIntroAudioSrc =
    presentationMode === 'voice' ? COORDINATOR_ONBOARDING_INTRO.audioSrc : null;
  const configuredAscentAudioSrc = COORDINATOR_ONBOARDING_INTRO.ascentAudioSrc;
  // Pre-computed lipsync track for the intro audio (same offline flow as the
  // landing page). The mouth is sampled from this by playback time rather than
  // analysed live, which keeps it deterministic.
  const lipsyncTrackRef = React.useRef<PrecomputedDroidLipsyncTrack | null>(null);

  React.useEffect(() => {
    onReadyToRevealSurfaceRef.current = onReadyToRevealSurface;
    onFinishedRef.current = onFinished;
    onSkippedRef.current = onSkipped;
  }, [onFinished, onReadyToRevealSurface, onSkipped]);

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

  const finishOnce = React.useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    keepAudioAfterUnmountRef.current = true;
    onFinishedRef.current();
  }, []);

  // Skip the bulk of the monologue: seek the audio to Marty's closing
  // question and compress the city ascent. When the seeked line ends, the
  // existing ``ended`` handler lands and hands off to the call as a natural
  // finish would.
  const skipToClosingQuestion = React.useCallback(() => {
    if (!timelineEnabled || hasFinishedRef.current || stage === 'landing') return;
    skipRequestedRef.current = true;
    // Retire the countdown — it's no longer meaningful once we've jumped to
    // the closing line.
    onSkippedRef.current?.();
    onReadyToRevealSurfaceRef.current?.();
    const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
    const audio = coordinatorWindow.__coordinatorOnboardingIntroAudio;
    if (audio) {
      audio.currentTime = getPlayableAudioTime(
        audio,
        COORDINATOR_ONBOARDING_INTRO.closingQuestionSec
      );
      void audio.play().catch(() => undefined);
    }
    // From the seated speaking beats, kick off the compressed ascent into
    // the call position. If we're already flying, leave the in-flight
    // ascent untouched and just let the seeked-to line carry us to landing.
    if (stage === 'pause' || stage === 'speaking') {
      setSkipped(true);
      setStage('flying');
    }
  }, [stage, timelineEnabled]);

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
    if (!timelineEnabled) return undefined;
    const { durationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs);
    const surfaceRevealOffsetMs = getSurfaceRevealOffsetMs(durationMs);
    const speakingStartTimer = window.setTimeout(
      () => setStage('speaking'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );
    const backgroundStartTimer = window.setTimeout(
      () => setStage((currentStage) => (currentStage === 'speaking' ? 'flying' : currentStage)),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs +
        COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs
    );
    const surfaceRevealTimer = window.setTimeout(
      () => onReadyToRevealSurfaceRef.current?.(),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + surfaceRevealOffsetMs
    );
    const landingTimer = window.setTimeout(
      () => scheduleLanding(),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + handoffOffsetMs
    );
    let landingDelayTimer: number | null = null;
    let audio: HTMLAudioElement | null = null;
    let audioTimer: number | null = null;
    let animationFrame = 0;
    let hasStartedAudio = false;
    let shouldPublishToComponent = true;

    function scheduleLanding() {
      if (hasFinishedRef.current || landingDelayTimer !== null) return;
      landingDelayTimer = window.setTimeout(() => {
        landingDelayTimer = null;
        if (!hasFinishedRef.current) setStage('landing');
      }, COORDINATOR_ONBOARDING_INTRO.teleportOutDelayMs);
    }

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
    // analyser is constructed, so the mouth animation is stable across runs.
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

        if (skipRequestedRef.current) {
          audio.currentTime = getPlayableAudioTime(
            audio,
            COORDINATOR_ONBOARDING_INTRO.closingQuestionSec
          );
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
            scheduleLanding();
          }
        },
        { once: true }
      );
    }

    return () => {
      window.clearTimeout(speakingStartTimer);
      window.clearTimeout(backgroundStartTimer);
      window.clearTimeout(surfaceRevealTimer);
      window.clearTimeout(landingTimer);
      if (landingDelayTimer !== null) window.clearTimeout(landingDelayTimer);
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
  }, [configuredIntroAudioSrc, timelineEnabled]);

  React.useEffect(() => {
    if (!timelineEnabled || presentationMode !== 'text') {
      setTextBubbleIndex(-1);
      return undefined;
    }

    const { durationMs } = getRuntimeTiming();
    let animationFrame = 0;
    let startTimestamp: number | null = null;
    const startTimer = window.setTimeout(
      () => {
        const tick = (timestamp: number) => {
          if (startTimestamp === null) startTimestamp = timestamp;
          const elapsedMs = timestamp - startTimestamp;
          const progress = Math.max(0, Math.min(1, elapsedMs / Math.max(1, durationMs)));
          const lineIndex = skipped
            ? MARTY_TEXT_BUBBLE_LINES.length - 1
            : Math.min(
                MARTY_TEXT_BUBBLE_LINES.length - 1,
                Math.floor(progress * MARTY_TEXT_BUBBLE_LINES.length)
              );
          setTextBubbleIndex(lineIndex);
          if (progress < 1) {
            animationFrame = window.requestAnimationFrame(tick);
          }
        };
        animationFrame = window.requestAnimationFrame(tick);
      },
      skipped ? 0 : COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );

    return () => {
      window.clearTimeout(startTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [presentationMode, skipped, timelineEnabled]);

  React.useEffect(() => {
    if (stage === 'landing') setTextBubbleIndex(-1);
  }, [stage]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'flying') return;

    playCoordinatorCityAmbience(COORDINATOR_ONBOARDING_INTRO.cityAmbienceSrc);

    const { durationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs);
    const motionDurationMs = skipped
      ? SKIP_FLY_MS
      : Math.max(1, handoffOffsetMs - COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs);
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
      setCoordinatorOnboardingBackgroundMusicVolume(
        COORDINATOR_ONBOARDING_INTRO.backgroundMusicVolume * cityOpacity
      );
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      stopCoordinatorCityAmbience();
    };
  }, [skipped, stage]);

  React.useEffect(() => {
    if (!configuredAscentAudioSrc || stage !== 'flying') return;

    playCoordinatorAscentSound(configuredAscentAudioSrc, skipped);

    return () => {
      stopCoordinatorAscentSound();
    };
  }, [configuredAscentAudioSrc, skipped, stage]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'landing') return;

    root.style.setProperty('--coordinator-intro-city-position', '0%');
    root.style.setProperty('--coordinator-intro-city-opacity', '0');
    setCoordinatorCitySoundscapeVolume(0);
    setCoordinatorOnboardingBackgroundMusicVolume(0);
    const handle = window.setTimeout(() => {
      finishOnce();
    }, COORDINATOR_ONBOARDING_INTRO.landingDurationMs);

    return () => window.clearTimeout(handle);
  }, [finishOnce, stage]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden',
        surfaceVisible
          ? 'pointer-events-none bg-transparent'
          : 'brand-page-stencil-bg coordinator-onboarding-city-bg bg-background'
      )}
      data-background-motion={
        stage === 'flying' ? 'scrolling' : stage === 'landing' ? 'landing' : 'idle'
      }
      data-testid="coordinator-onboarding-call-intro"
    >
      {controlOverlay && (
        <div
          className="pointer-events-none absolute bottom-4 right-4 z-50 transition-opacity duration-300"
          style={{ opacity: 'var(--coordinator-intro-city-opacity, 1)' }}
        >
          {controlOverlay}
        </div>
      )}
      <motion.div
        initial={{ opacity: 1, x: initialAvatarOffset.x, y: initialAvatarOffset.y, scale: 1 }}
        animate={{
          opacity: 1,
          x: initialAvatarOffset.x,
          y: initialAvatarOffset.y,
          scale: 1,
        }}
        exit={{ opacity: 1, x: initialAvatarOffset.x, y: initialAvatarOffset.y, scale: 1 }}
        transition={{ duration: 0.28 }}
        className="flex items-center justify-center"
      >
        <div className="relative" style={{ width: framePx, height: framePx }}>
          {presentationMode === 'text' && stage !== 'landing' && textBubbleIndex >= 0 && (
            <span className="coordinator-onboarding-droid-speech is-visible">
              {MARTY_TEXT_BUBBLE_LINES[textBubbleIndex]}
            </span>
          )}
          {/* One Marty avatar speaks throughout, then teleports the same fixed
           * appearance into the docked call surface. */}
          <DroidTeleportFizzle
            mode="out"
            active={stage === 'landing'}
            className="absolute inset-0 block"
          >
            <SeatedCoordinatorDroid
              droid={MARTY_DROID_APPEARANCE}
              width={droidWidth}
              isSpeaking={
                presentationMode === 'voice'
                  ? stage !== 'pause'
                  : stage !== 'pause' && textBubbleIndex >= 0
              }
              mouthShape={presentationMode === 'voice' ? audioMouthShape : 'narrow'}
              speechLevel={
                presentationMode === 'voice'
                  ? configuredIntroAudioSrc
                    ? audioSpeechLevel
                    : undefined
                  : textBubbleIndex >= 0
                    ? 0.48
                    : 0
              }
            />
          </DroidTeleportFizzle>
        </div>
      </motion.div>
    </div>
  );
}
