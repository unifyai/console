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
  context: AudioContext;
};
type CoordinatorIntroBackgroundMusicState = {
  audio: HTMLAudioElement;
  src: string;
};
type CoordinatorIntroBackgroundMusicStartOptions = {
  fadeIn?: boolean;
};
type TwinTextBubbleCue = {
  startMs: number;
  text: string;
};

// When skipping, the elevator ascent is compressed to a quick rise so the
// droid reaches his call position in step with the seeked-to closing line.
const SKIP_FLY_MS = 1_400;
const ASCENT_SOUND_VOLUME = 0.27;
const ASCENT_SOUND_SKIP_OFFSET_SEC = 32;
const COORDINATOR_INTRO_VOICE_VOLUME = 0.8;
const COORDINATOR_INTRO_RADIO_STORAGE_KEY = 'console:coordinator-onboarding-radio-enabled';
const COORDINATOR_INTRO_RADIO_TOGGLE_CUE_SRC = '/sounds/radio-station-crackle.wav';
const COORDINATOR_INTRO_RADIO_TOGGLE_CUE_VOLUME = 0.22;
const COORDINATOR_INTRO_RADIO_TOGGLE_CUE_MS = 620;
const COORDINATOR_INTRO_ARRIVAL_DING_SRC = '/sounds/twin-onboarding-arrival-ding.mp3';
const COORDINATOR_INTRO_ARRIVAL_DING_VOLUME = 0.16;
const COORDINATOR_INTRO_RADIO_MUSIC_FADE_OUT_MS = 90;
const COORDINATOR_INTRO_RADIO_MUSIC_FADE_IN_MS = 160;
let coordinatorCitySoundscapeState: CoordinatorCitySoundscapeState | null = null;
let coordinatorCitySoundscapeCleanupTimer: number | null = null;
let coordinatorIntroBackgroundMusicState: CoordinatorIntroBackgroundMusicState | null = null;
let coordinatorIntroToggleCueAudio: HTMLAudioElement | null = null;
let coordinatorIntroToggleCueStopTimer: number | null = null;
let coordinatorIntroArrivalDingAudio: HTMLAudioElement | null = null;
let coordinatorIntroMusicFadeFrame: number | null = null;
let coordinatorIntroRadioEnabled = true;
let coordinatorIntroRadioPreferenceLoaded = false;
let coordinatorIntroBackgroundMusicVolume: number =
  COORDINATOR_ONBOARDING_INTRO.backgroundMusicVolume;
let coordinatorIntroBackgroundMusicVolumeScale = 1;

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

function getCoordinatorIntroRadioStationTargetVolume() {
  return (
    COORDINATOR_ONBOARDING_INTRO.backgroundMusicVolume * coordinatorIntroBackgroundMusicVolumeScale
  );
}

function resetCoordinatorIntroBackgroundMusicVolumeScale() {
  coordinatorIntroBackgroundMusicVolumeScale = 1;
  coordinatorIntroBackgroundMusicVolume = getCoordinatorIntroRadioStationTargetVolume();
}

function cancelCoordinatorIntroMusicFade() {
  if (coordinatorIntroMusicFadeFrame === null) return;
  window.cancelAnimationFrame(coordinatorIntroMusicFadeFrame);
  coordinatorIntroMusicFadeFrame = null;
}

function fadeCoordinatorIntroBackgroundMusicVolume(
  audio: HTMLAudioElement,
  toVolume: number,
  durationMs: number,
  onComplete?: () => void
) {
  cancelCoordinatorIntroMusicFade();

  const fromVolume = audio.volume;
  const startedAt = performance.now();

  const step = (now: number) => {
    const progress = durationMs <= 0 ? 1 : Math.min(1, (now - startedAt) / durationMs);
    audio.volume = clampAudioVolume(fromVolume + (toVolume - fromVolume) * progress);

    if (progress < 1) {
      coordinatorIntroMusicFadeFrame = window.requestAnimationFrame(step);
      return;
    }

    coordinatorIntroMusicFadeFrame = null;
    onComplete?.();
  };

  coordinatorIntroMusicFadeFrame = window.requestAnimationFrame(step);
}

function stopCoordinatorIntroAudio(audio: HTMLAudioElement | null, releaseSource = false) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  if (!releaseSource) return;
  audio.removeAttribute('src');
  audio.load();
}

function stopCoordinatorIntroToggleCue(releaseSource = false) {
  if (coordinatorIntroToggleCueStopTimer !== null) {
    window.clearTimeout(coordinatorIntroToggleCueStopTimer);
    coordinatorIntroToggleCueStopTimer = null;
  }
  stopCoordinatorIntroAudio(coordinatorIntroToggleCueAudio, releaseSource);
  if (releaseSource) coordinatorIntroToggleCueAudio = null;
}

function playCoordinatorIntroToggleCue() {
  if (typeof window === 'undefined' || document.hidden) return;
  stopCoordinatorIntroToggleCue();

  if (!coordinatorIntroToggleCueAudio) {
    coordinatorIntroToggleCueAudio = new Audio(COORDINATOR_INTRO_RADIO_TOGGLE_CUE_SRC);
    coordinatorIntroToggleCueAudio.preload = 'auto';
  }

  const audio = coordinatorIntroToggleCueAudio;
  audio.volume = COORDINATOR_INTRO_RADIO_TOGGLE_CUE_VOLUME;
  void audio.play().catch(() => undefined);

  coordinatorIntroToggleCueStopTimer = window.setTimeout(() => {
    stopCoordinatorIntroToggleCue();
  }, COORDINATOR_INTRO_RADIO_TOGGLE_CUE_MS);
}

function playCoordinatorIntroArrivalDing() {
  if (typeof window === 'undefined' || document.hidden) return;

  if (!coordinatorIntroArrivalDingAudio) {
    coordinatorIntroArrivalDingAudio = new Audio(COORDINATOR_INTRO_ARRIVAL_DING_SRC);
    coordinatorIntroArrivalDingAudio.preload = 'auto';
  }

  const audio = coordinatorIntroArrivalDingAudio;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = COORDINATOR_INTRO_ARRIVAL_DING_VOLUME;
  void audio.play().catch(() => undefined);
}

function persistCoordinatorIntroRadioPreference() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      COORDINATOR_INTRO_RADIO_STORAGE_KEY,
      coordinatorIntroRadioEnabled ? 'on' : 'off'
    );
  } catch {
    // Storage can be unavailable in private or locked-down browsing modes.
  }
}

function loadCoordinatorIntroRadioPreference() {
  if (coordinatorIntroRadioPreferenceLoaded || typeof window === 'undefined') return;
  coordinatorIntroRadioPreferenceLoaded = true;
  try {
    const stored = window.localStorage.getItem(COORDINATOR_INTRO_RADIO_STORAGE_KEY);
    if (stored === 'on') coordinatorIntroRadioEnabled = true;
    if (stored === 'off') coordinatorIntroRadioEnabled = false;
  } catch {
    coordinatorIntroRadioEnabled = true;
  }
}

export function getCoordinatorOnboardingBackgroundMusicEnabled() {
  loadCoordinatorIntroRadioPreference();
  return coordinatorIntroRadioEnabled;
}

export function setCoordinatorOnboardingBackgroundMusicEnabled(enabled: boolean) {
  loadCoordinatorIntroRadioPreference();
  coordinatorIntroRadioEnabled = enabled;
  persistCoordinatorIntroRadioPreference();
  playCoordinatorIntroToggleCue();

  if (enabled) {
    resetCoordinatorIntroBackgroundMusicVolumeScale();
    startCoordinatorOnboardingBackgroundMusic({ fadeIn: true });
    return;
  }

  const state = coordinatorIntroBackgroundMusicState;
  if (!state) return;
  fadeCoordinatorIntroBackgroundMusicVolume(
    state.audio,
    0,
    COORDINATOR_INTRO_RADIO_MUSIC_FADE_OUT_MS,
    () => {
      state.audio.pause();
      state.audio.currentTime = 0;
    }
  );
}

export function startCoordinatorOnboardingBackgroundMusic(
  options: CoordinatorIntroBackgroundMusicStartOptions = {}
) {
  if (typeof window === 'undefined') return;
  loadCoordinatorIntroRadioPreference();
  if (!coordinatorIntroRadioEnabled) return;

  const src = COORDINATOR_ONBOARDING_INTRO.backgroundMusicSrc;
  if (!src) return;

  let state = coordinatorIntroBackgroundMusicState;
  if (!state || state.src !== src) {
    if (state) {
      state.audio.pause();
      state.audio.removeAttribute('src');
      state.audio.load();
    }
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    state = { audio, src };
    coordinatorIntroBackgroundMusicState = state;
  }

  const targetVolume = getCoordinatorIntroRadioStationTargetVolume();
  coordinatorIntroBackgroundMusicVolume = targetVolume;
  cancelCoordinatorIntroMusicFade();

  if (options.fadeIn) {
    state.audio.volume = 0;
    void state.audio
      .play()
      .then(() => {
        fadeCoordinatorIntroBackgroundMusicVolume(
          state.audio,
          targetVolume,
          COORDINATOR_INTRO_RADIO_MUSIC_FADE_IN_MS
        );
      })
      .catch(() => undefined);
    return;
  }

  state.audio.volume = clampAudioVolume(coordinatorIntroBackgroundMusicVolume);
  void state.audio.play().catch(() => undefined);
}

function setCoordinatorOnboardingBackgroundMusicVolume(volume: number) {
  const stationVolume = COORDINATOR_ONBOARDING_INTRO.backgroundMusicVolume;
  coordinatorIntroBackgroundMusicVolumeScale =
    stationVolume > 0 ? clampAudioVolume(volume / stationVolume) : 0;
  coordinatorIntroBackgroundMusicVolume = getCoordinatorIntroRadioStationTargetVolume();
  const state = coordinatorIntroBackgroundMusicState;
  if (!state) return;
  state.audio.volume = clampAudioVolume(coordinatorIntroBackgroundMusicVolume);
}

export function stopCoordinatorOnboardingBackgroundMusic() {
  stopCoordinatorIntroToggleCue(true);
  cancelCoordinatorIntroMusicFade();
  const state = coordinatorIntroBackgroundMusicState;
  if (!state) return;

  stopCoordinatorIntroAudio(state.audio, true);
  coordinatorIntroBackgroundMusicState = null;
  resetCoordinatorIntroBackgroundMusicVolumeScale();
}

function stopCoordinatorOnboardingBackgroundMusicWithCue() {
  playCoordinatorIntroToggleCue();
  cancelCoordinatorIntroMusicFade();
  const state = coordinatorIntroBackgroundMusicState;
  if (!state) return;

  fadeCoordinatorIntroBackgroundMusicVolume(
    state.audio,
    0,
    COORDINATOR_INTRO_RADIO_MUSIC_FADE_OUT_MS,
    () => {
      stopCoordinatorIntroAudio(state.audio, true);
      if (coordinatorIntroBackgroundMusicState === state) {
        coordinatorIntroBackgroundMusicState = null;
      }
      resetCoordinatorIntroBackgroundMusicVolumeScale();
    }
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
  const ascentGain = context.createGain();
  ascentGain.gain.value = 0;
  ascentGain.connect(context.destination);

  coordinatorCitySoundscapeState = {
    ascentBufferPromise: null,
    ascentGain,
    ascentSource: null,
    context,
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

function cleanupCoordinatorCitySoundscape() {
  const state = coordinatorCitySoundscapeState;
  if (!state) return;

  stopCoordinatorAscentSound(state);

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

  if (!coordinatorIntroArrivalDingAudio) {
    coordinatorIntroArrivalDingAudio = new Audio(COORDINATOR_INTRO_ARRIVAL_DING_SRC);
    coordinatorIntroArrivalDingAudio.preload = 'auto';
  }

  void loadCoordinatorAscentSoundBuffer(state, COORDINATOR_ONBOARDING_INTRO.ascentAudioSrc).catch(
    () => {
      state.ascentBufferPromise = null;
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

function audioElementMatchesSrc(audio: HTMLAudioElement, src: string) {
  return (
    new URL(audio.currentSrc || audio.src, window.location.href).href ===
    new URL(src, window.location.href).href
  );
}

export function primeCoordinatorOnboardingIntroVoice() {
  if (typeof window === 'undefined') return;
  const src = COORDINATOR_ONBOARDING_INTRO.audioSrc;
  const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
  let audio = coordinatorWindow.__coordinatorOnboardingIntroAudio;

  if (!audio || audio.ended || !audioElementMatchesSrc(audio, src)) {
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = COORDINATOR_INTRO_VOICE_VOLUME;
    coordinatorWindow.__coordinatorOnboardingIntroAudio = audio;
  }

  audio.muted = true;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = COORDINATOR_INTRO_VOICE_VOLUME;
    })
    .catch(() => {
      audio.muted = false;
      audio.volume = COORDINATOR_INTRO_VOICE_VOLUME;
    });
}

interface CoordinatorOnboardingCallIntroProps {
  initialAvatarOffset: { x: number; y: number };
  timelineEnabled?: boolean;
  presentationMode?: 'voice' | 'text';
  onReadyToRevealSurface?: () => void;
  onFinished: () => void;
  skipSignal?: number;
  onSkipped?: () => void;
  surfaceVisible?: boolean;
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

function easeArrivalProgress(progress: number) {
  const easeStart = 0.68;
  if (progress <= easeStart) return progress;

  const tailProgress = (progress - easeStart) / (1 - easeStart);
  const easedTail = tailProgress + tailProgress * tailProgress - tailProgress ** 3;
  return easeStart + easedTail * (1 - easeStart);
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
    (TWIN_PLATFORM_REVEAL_SOURCE_MS * durationMs) / COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs
  );
}

const TWIN_DROID_APPEARANCE = COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID;
const TWIN_BACKGROUND_ARRIVAL_SOURCE_MS = 63_868;
const TWIN_RADIO_STOP_SOURCE_MS = 66_643;
const TWIN_PLATFORM_REVEAL_SOURCE_MS = 71_766;
const TWIN_TEXT_BUBBLE_CUES = [
  { startMs: 285, text: "Hi, I'm T dash W 1 N." },
  {
    startMs: 3_222,
    text: "Before you ask, no I'm not one of Elon's many children,",
  },
  { startMs: 5_846, text: "and no he didn't come up with the name, thankfully." },
  {
    startMs: 8_865,
    text: "I have this name because I'll be acting as your digital twin.",
  },
  { startMs: 12_429, text: 'Do you get it?' },
  { startMs: 13_810, text: 'Twin?' },
  { startMs: 14_519, text: 'Like T dash W 1 N spells Twin?' },
  {
    startMs: 17_979,
    text: "The creators of this platform express how important it is that you acknowledge that it's a clever and funny name.",
  },
  { startMs: 25_038, text: 'Okay, what next.' },
  {
    startMs: 26_849,
    text: "They didn't give me much to work with on this intro to be honest.",
  },
  { startMs: 30_332, text: 'Have you ever had a Krispy Kreme?' },
  { startMs: 32_329, text: 'Have you ever gone to Krispy Kreme?' },
  { startMs: 34_430, text: 'Was it krispy?' },
  { startMs: 37_632, text: 'I think I was meant to tell you about my capabilities?' },
  {
    startMs: 40_523,
    text: "I'm not one for bragging, but I'll do my best.",
  },
  {
    startMs: 43_472,
    text: 'Basically, I\'m not a "tool", I\'m not an "agent",',
  },
  {
    startMs: 46_758,
    text: "I'm your living breathing copilot (metaphorically speaking. At the lawyers request).",
  },
  {
    startMs: 51_425,
    text: "Don't think about prompting me, or configuring me,",
  },
  {
    startMs: 54_119,
    text: "just talk to me naturally like you would anyone else, and I'll be able to help.",
  },
  { startMs: 58_682, text: "It's really that simple." },
  { startMs: 60_446, text: "There's not much more to say." },
  { startMs: 61_636, text: "I'll now walk you through the platform." },
  {
    startMs: 63_377,
    text: 'Actually, first lets turn off this really annoying music.',
  },
  { startMs: 66_849, text: 'Much better.' },
  {
    startMs: 68_126,
    text: "Also, let me fix my audio, it's a bit crackly.",
  },
  { startMs: 71_766, text: "There we go, now I'll pull up the platform." },
  { startMs: 73_751, text: 'Any questions before we start with the onboarding?' },
] as const satisfies readonly TwinTextBubbleCue[];

function getBackgroundArrivalOffsetMs(durationMs: number) {
  return Math.max(
    COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs + 500,
    (TWIN_BACKGROUND_ARRIVAL_SOURCE_MS * durationMs) /
      COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs
  );
}

function getRadioStopOffsetMs(durationMs: number) {
  return Math.max(
    COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs + 500,
    (TWIN_RADIO_STOP_SOURCE_MS * durationMs) / COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs
  );
}

function getTwinTextBubbleCueIndex(elapsedMs: number, durationMs: number) {
  const sourceElapsedMs =
    (elapsedMs * COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs) / Math.max(1, durationMs);
  return getTwinTextBubbleCueIndexForSourceElapsed(sourceElapsedMs);
}

function getTwinTextBubbleCueIndexForSourceElapsed(sourceElapsedMs: number) {
  let cueIndex = 0;
  for (let index = 1; index < TWIN_TEXT_BUBBLE_CUES.length; index += 1) {
    if (sourceElapsedMs < TWIN_TEXT_BUBBLE_CUES[index].startMs) break;
    cueIndex = index;
  }
  return cueIndex;
}

const TWIN_TEXT_SKIP_CUE_INDEX = Math.max(
  0,
  TWIN_TEXT_BUBBLE_CUES.findIndex(
    (cue) => cue.startMs >= COORDINATOR_ONBOARDING_INTRO.closingQuestionSec * 1_000
  ) - 1
);
const TWIN_TEXT_SKIP_START_MS = TWIN_TEXT_BUBBLE_CUES[TWIN_TEXT_SKIP_CUE_INDEX].startMs;

export function CoordinatorOnboardingCallIntro({
  initialAvatarOffset,
  timelineEnabled = true,
  presentationMode = 'voice',
  onReadyToRevealSurface,
  onFinished,
  skipSignal = 0,
  onSkipped,
  surfaceVisible = false,
}: CoordinatorOnboardingCallIntroProps) {
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const onReadyToRevealSurfaceRef = React.useRef(onReadyToRevealSurface);
  const onFinishedRef = React.useRef(onFinished);
  const onSkippedRef = React.useRef(onSkipped);
  const hasFinishedRef = React.useRef(false);
  const keepAudioAfterUnmountRef = React.useRef(false);
  const landingDelayTimerRef = React.useRef<number | null>(null);
  const presentationModeRef = React.useRef(presentationMode);
  const latestSourceElapsedMsRef = React.useRef(0);
  // Set when "Skip" is pressed before the audio element has begun playing; the
  // start handler then seeks immediately.
  const skipRequestedRef = React.useRef(false);
  const previousSkipSignalRef = React.useRef(skipSignal);
  const [stage, setStage] = React.useState<IntroStage>('pause');
  const [skipped, setSkipped] = React.useState(false);
  const [audioSpeechLevel, setAudioSpeechLevel] = React.useState(0);
  const [audioMouthShape, setAudioMouthShape] = React.useState<CreatureMouthShape>('closed');
  const [textBubbleIndex, setTextBubbleIndex] = React.useState(-1);
  const [textModeSourceOffsetMs, setTextModeSourceOffsetMs] = React.useState(0);
  const configuredIntroAudioSrc =
    presentationMode === 'voice' ? COORDINATOR_ONBOARDING_INTRO.audioSrc : null;
  const configuredAscentAudioSrc = COORDINATOR_ONBOARDING_INTRO.ascentAudioSrc;
  // Pre-computed lipsync track for the intro audio (same offline flow as the
  // landing page). The mouth is sampled from this by playback time rather than
  // analysed live, which keeps it deterministic.
  const lipsyncTrackRef = React.useRef<PrecomputedDroidLipsyncTrack | null>(null);
  presentationModeRef.current = presentationMode;

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

  const scheduleLanding = React.useCallback(() => {
    if (hasFinishedRef.current || landingDelayTimerRef.current !== null) return;
    landingDelayTimerRef.current = window.setTimeout(() => {
      landingDelayTimerRef.current = null;
      if (!hasFinishedRef.current) setStage('landing');
    }, COORDINATOR_ONBOARDING_INTRO.teleportOutDelayMs);
  }, []);

  // Skip the bulk of the monologue: seek the audio to Twin's closing
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
      latestSourceElapsedMsRef.current = audio.currentTime * 1_000;
      void audio.play().catch(() => undefined);
    }
    // From any pre-landing beat, compress the ascent into the call position.
    setSkipped(true);
    setStage((currentStage) =>
      currentStage === 'pause' || currentStage === 'speaking' ? 'flying' : currentStage
    );
  }, [stage, timelineEnabled]);

  React.useEffect(() => {
    if (skipSignal === previousSkipSignalRef.current) return;
    previousSkipSignalRef.current = skipSignal;
    if (skipSignal === 0) return;
    skipToClosingQuestion();
  }, [skipSignal, skipToClosingQuestion]);

  React.useEffect(() => {
    return () => {
      if (landingDelayTimerRef.current !== null) {
        window.clearTimeout(landingDelayTimerRef.current);
        landingDelayTimerRef.current = null;
      }
      cleanupCoordinatorCitySoundscape();
    };
  }, []);

  React.useEffect(() => {
    if (!timelineEnabled) return undefined;
    const { durationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs);
    const surfaceRevealOffsetMs = getSurfaceRevealOffsetMs(durationMs);
    const radioStopOffsetMs = getRadioStopOffsetMs(durationMs);
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
    const radioStopTimer = window.setTimeout(
      () => stopCoordinatorOnboardingBackgroundMusicWithCue(),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + radioStopOffsetMs
    );
    const landingTimer = window.setTimeout(
      () => scheduleLanding(),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + handoffOffsetMs
    );

    return () => {
      window.clearTimeout(speakingStartTimer);
      window.clearTimeout(backgroundStartTimer);
      window.clearTimeout(surfaceRevealTimer);
      window.clearTimeout(radioStopTimer);
      window.clearTimeout(landingTimer);
    };
  }, [scheduleLanding, timelineEnabled]);

  React.useEffect(() => {
    if (!timelineEnabled || !configuredIntroAudioSrc) return undefined;

    const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
    let audio: HTMLAudioElement | null =
      coordinatorWindow.__coordinatorOnboardingIntroAudio &&
      !coordinatorWindow.__coordinatorOnboardingIntroAudio.ended &&
      audioElementMatchesSrc(
        coordinatorWindow.__coordinatorOnboardingIntroAudio,
        configuredIntroAudioSrc
      )
        ? coordinatorWindow.__coordinatorOnboardingIntroAudio
        : new Audio(configuredIntroAudioSrc);
    let audioTimer: number | null = null;
    let animationFrame = 0;
    let hasStartedAudio = false;
    let shouldPublishToComponent = true;

    audio.currentTime = getPlayableAudioTime(audio, latestSourceElapsedMsRef.current / 1_000);
    audio.muted = false;
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = COORDINATOR_INTRO_VOICE_VOLUME;

    const previousAudio = coordinatorWindow.__coordinatorOnboardingIntroAudio;
    if (previousAudio && previousAudio !== audio) {
      previousAudio.pause();
      previousAudio.currentTime = 0;
      previousAudio.removeAttribute('src');
      previousAudio.load();
    }
    coordinatorWindow.__coordinatorOnboardingIntroAudio = audio;

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
        latestSourceElapsedMsRef.current = audioElement.currentTime * 1_000;
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

    const handleEnded = () => {
      if (coordinatorWindow.__coordinatorOnboardingIntroAudio === audio) {
        coordinatorWindow.__coordinatorOnboardingIntroAudio = undefined;
      }
      stopAudioAnalysis(!hasFinishedRef.current);
      if (!hasFinishedRef.current) {
        scheduleLanding();
      }
    };

    audio.addEventListener('ended', handleEnded, { once: true });
    audioTimer = window.setTimeout(
      () => {
        if (!audio) return;
        if (hasStartedAudio) return;
        hasStartedAudio = true;

        if (skipRequestedRef.current) {
          audio.currentTime = getPlayableAudioTime(
            audio,
            COORDINATOR_ONBOARDING_INTRO.closingQuestionSec
          );
        } else if (latestSourceElapsedMsRef.current > 0) {
          audio.currentTime = getPlayableAudioTime(audio, latestSourceElapsedMsRef.current / 1_000);
        }
        startAudioAnalysis(audio);
        audio.play().catch(() => {
          stopAudioAnalysis();
        });
      },
      latestSourceElapsedMsRef.current > 0 ? 0 : COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );

    return () => {
      if (audioTimer !== null) window.clearTimeout(audioTimer);
      const keepAudioPlaying = keepAudioAfterUnmountRef.current && !!audio && !audio.ended;
      shouldPublishToComponent = false;
      if (
        audio &&
        presentationModeRef.current === 'text' &&
        !hasFinishedRef.current &&
        !audio.ended
      ) {
        latestSourceElapsedMsRef.current = audio.currentTime * 1_000;
        setTextModeSourceOffsetMs(latestSourceElapsedMsRef.current);
      }
      if (!keepAudioPlaying) {
        stopAudioAnalysis();
      }
      if (audio) {
        audio.removeEventListener('ended', handleEnded);
        if (!keepAudioPlaying && coordinatorWindow.__coordinatorOnboardingIntroAudio === audio) {
          coordinatorWindow.__coordinatorOnboardingIntroAudio = undefined;
        }
        if (!keepAudioPlaying) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio = null;
      }
    };
  }, [configuredIntroAudioSrc, scheduleLanding, timelineEnabled]);

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
          const sourceElapsedMs = skipped
            ? TWIN_TEXT_SKIP_START_MS + elapsedMs
            : textModeSourceOffsetMs > 0
              ? textModeSourceOffsetMs + elapsedMs
              : (elapsedMs * COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs) /
                Math.max(1, durationMs);
          latestSourceElapsedMsRef.current = sourceElapsedMs;
          const lineIndex =
            skipped || textModeSourceOffsetMs > 0
              ? getTwinTextBubbleCueIndexForSourceElapsed(sourceElapsedMs)
              : getTwinTextBubbleCueIndex(elapsedMs, durationMs);
          setTextBubbleIndex((current) => (current === lineIndex ? current : lineIndex));
          if (sourceElapsedMs < COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs) {
            animationFrame = window.requestAnimationFrame(tick);
          }
        };
        animationFrame = window.requestAnimationFrame(tick);
      },
      skipped || textModeSourceOffsetMs > 0 ? 0 : COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );

    return () => {
      window.clearTimeout(startTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [presentationMode, skipped, textModeSourceOffsetMs, timelineEnabled]);

  React.useEffect(() => {
    if (stage === 'landing') setTextBubbleIndex(-1);
  }, [stage]);

  React.useEffect(() => {
    if (!timelineEnabled || presentationMode !== 'text' || !skipped || stage !== 'flying') return;
    const remainingTextMs = Math.max(
      0,
      COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs - TWIN_TEXT_SKIP_START_MS
    );
    const landingDelayMs =
      Math.max(SKIP_FLY_MS, remainingTextMs) + COORDINATOR_ONBOARDING_INTRO.teleportOutDelayMs;
    const handle = window.setTimeout(() => {
      if (!hasFinishedRef.current) setStage('landing');
    }, landingDelayMs);

    return () => window.clearTimeout(handle);
  }, [presentationMode, skipped, stage, timelineEnabled]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'flying') return;

    const { durationMs } = getRuntimeTiming();
    const backgroundArrivalOffsetMs = getBackgroundArrivalOffsetMs(durationMs);
    const motionDurationMs = skipped
      ? SKIP_FLY_MS
      : Math.max(
          1,
          backgroundArrivalOffsetMs - COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs
        );
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
    let hasArrived = false;

    const tick = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const elapsedMs = timestamp - startTimestamp;
      const progress = getAcceleratedScrollProgress(
        elapsedMs,
        motionDurationMs,
        COORDINATOR_ONBOARDING_INTRO.backgroundAccelerationMs
      );
      const easedProgress = skipped ? progress : easeArrivalProgress(progress);
      const position = skipped ? startPosition * (1 - easedProgress) : (1 - easedProgress) * 100;
      root.style.setProperty('--coordinator-intro-city-position', `${position}%`);
      root.style.setProperty('--coordinator-intro-city-opacity', '1');

      if (progress >= 1) {
        if (!hasArrived) {
          hasArrived = true;
          root.style.setProperty('--coordinator-intro-city-position', '0%');
          playCoordinatorIntroArrivalDing();
          stopCoordinatorAscentSound();
        }
      } else {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
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
    setCoordinatorOnboardingBackgroundMusicVolume(0);
    const handle = window.setTimeout(() => {
      finishOnce();
    }, COORDINATOR_ONBOARDING_INTRO.landingDurationMs);

    return () => window.clearTimeout(handle);
  }, [finishOnce, stage]);

  const textBubbleCue = textBubbleIndex >= 0 ? TWIN_TEXT_BUBBLE_CUES[textBubbleIndex] : undefined;

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
          {presentationMode === 'text' && stage !== 'landing' && textBubbleCue && (
            <span
              className="coordinator-onboarding-droid-speech is-visible"
              data-testid="coordinator-onboarding-droid-speech"
            >
              {textBubbleCue.text}
            </span>
          )}
          {/* One Twin avatar speaks throughout, then teleports the same fixed
           * appearance into the docked call surface. */}
          <DroidTeleportFizzle
            mode="out"
            active={stage === 'landing'}
            className="absolute inset-0 block"
          >
            <SeatedCoordinatorDroid
              droid={TWIN_DROID_APPEARANCE}
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
