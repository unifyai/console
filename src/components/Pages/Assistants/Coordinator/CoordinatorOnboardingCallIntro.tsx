'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { MartyCallAvatar } from '@/components/Pages/Assistants/Communication/MartyCallAvatar';
import {
  COORDINATOR_ONBOARDING_INTRO,
  COORDINATOR_ONBOARDING_MARTY_LAYOUT_TRANSITION,
} from '@/utils/assistants/coordinator-onboarding-intro';

type IntroStage = 'pause' | 'speaking' | 'flying' | 'landing';
type BrowserWindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};
type BrowserWindowWithMartyIntroAudio = Window & {
  __martyOnboardingIntroAudio?: HTMLAudioElement;
};

interface CoordinatorOnboardingCallIntroProps {
  initialAvatarOffset: { x: number; y: number };
  onReadyToStartCall: () => void;
  onFinished: () => void;
}

function getRuntimeTiming() {
  if (typeof window === 'undefined') {
    return {
      durationMs: COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs,
    };
  }

  const runtimeWindow = window as unknown as Record<string, number | undefined>;
  return {
    durationMs:
      runtimeWindow['__COORDINATOR_ONBOARDING_INTRO_DURATION_MS'] ??
      COORDINATOR_ONBOARDING_INTRO.fallbackDurationMs,
  };
}

function parseStencilTileHeight(value: string): number {
  const parts = value.trim().split(/\s+/);
  const heightToken = parts[1] ?? parts[0];
  const parsed = Number.parseFloat(heightToken);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 560;
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

export function CoordinatorOnboardingCallIntro({
  initialAvatarOffset,
  onReadyToStartCall,
  onFinished,
}: CoordinatorOnboardingCallIntroProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const offsetRef = React.useRef(0);
  const hasStartedCallRef = React.useRef(false);
  const hasFinishedRef = React.useRef(false);
  const [stage, setStage] = React.useState<IntroStage>('pause');
  const [audioSpeechLevel, setAudioSpeechLevel] = React.useState(0);

  const startCallOnce = React.useCallback(() => {
    if (hasStartedCallRef.current) return;
    hasStartedCallRef.current = true;
    onReadyToStartCall();
  }, [onReadyToStartCall]);

  const finishOnce = React.useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    startCallOnce();
    onFinished();
  }, [onFinished, startCallOnce]);

  React.useEffect(() => {
    const { durationMs } = getRuntimeTiming();
    const speakingStartTimer = window.setTimeout(
      () => setStage('speaking'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );
    const backgroundStartTimer = window.setTimeout(
      () => setStage((currentStage) => (currentStage === 'speaking' ? 'flying' : currentStage)),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs +
        COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs
    );
    const landingTimer = window.setTimeout(
      () => setStage('landing'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + durationMs
    );
    let audio: HTMLAudioElement | null = null;
    let audioTimer: number | null = null;
    let audioContext: AudioContext | null = null;
    let animationFrame = 0;
    let smoothedLevel = 0;
    let hasStartedAudio = false;

    const stopAudioAnalysis = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      smoothedLevel = 0;
      setAudioSpeechLevel(0);
    };

    const startAudioAnalysis = (audioElement: HTMLAudioElement) => {
      const AudioContextClass =
        window.AudioContext || (window as BrowserWindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) return;

      audioContext = new AudioContextClass();
      const source = audioContext.createMediaElementSource(audioElement);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const sample = samples[index];
          const centered = (sample - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const level = Math.max(0, Math.min(1, (rms - 0.012) * 10.5));
        smoothedLevel = smoothedLevel * 0.5 + level * 0.5;
        setAudioSpeechLevel(smoothedLevel);
        animationFrame = window.requestAnimationFrame(tick);
      };

      animationFrame = window.requestAnimationFrame(tick);
    };

    if (COORDINATOR_ONBOARDING_INTRO.audioSrc) {
      audio = new Audio(COORDINATOR_ONBOARDING_INTRO.audioSrc);
      audio.preload = 'auto';
      audio.loop = false;
      audioTimer = window.setTimeout(() => {
        if (!audio) return;
        if (hasStartedAudio) return;
        hasStartedAudio = true;

        const martyWindow = window as BrowserWindowWithMartyIntroAudio;
        const previousAudio = martyWindow.__martyOnboardingIntroAudio;
        if (previousAudio && previousAudio !== audio) {
          previousAudio.pause();
          previousAudio.currentTime = 0;
          previousAudio.removeAttribute('src');
          previousAudio.load();
        }
        martyWindow.__martyOnboardingIntroAudio = audio;

        startAudioAnalysis(audio);
        audioContext?.resume().catch(() => {});
        audio.play().catch(() => {
          stopAudioAnalysis();
        });
      }, COORDINATOR_ONBOARDING_INTRO.initialPauseMs);
      audio.addEventListener(
        'ended',
        () => {
          const martyWindow = window as BrowserWindowWithMartyIntroAudio;
          if (martyWindow.__martyOnboardingIntroAudio === audio) {
            martyWindow.__martyOnboardingIntroAudio = undefined;
          }
          stopAudioAnalysis();
          setStage('landing');
        },
        { once: true }
      );
    }

    return () => {
      window.clearTimeout(speakingStartTimer);
      window.clearTimeout(backgroundStartTimer);
      window.clearTimeout(landingTimer);
      if (audioTimer !== null) window.clearTimeout(audioTimer);
      stopAudioAnalysis();
      if (audio) {
        const martyWindow = window as BrowserWindowWithMartyIntroAudio;
        if (martyWindow.__martyOnboardingIntroAudio === audio) {
          martyWindow.__martyOnboardingIntroAudio = undefined;
        }
        audio.pause();
        audio.currentTime = 0;
      }
      audioContext?.close().catch(() => {});
    };
  }, [startCallOnce]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'flying') return;

    const { durationMs } = getRuntimeTiming();
    const motionDurationMs = Math.max(
      1,
      durationMs - COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs
    );
    const computed = window.getComputedStyle(root);
    const tileHeight = parseStencilTileHeight(computed.getPropertyValue('--chat-maze-size'));
    const loopCount = Math.max(
      1,
      Math.round(
        (COORDINATOR_ONBOARDING_INTRO.backgroundPixelsPerSecond * (motionDurationMs / 1_000)) /
          tileHeight
      )
    );
    let startTimestamp: number | null = null;
    let animationFrame = 0;

    const tick = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = getAcceleratedScrollProgress(
        timestamp - startTimestamp,
        motionDurationMs,
        COORDINATOR_ONBOARDING_INTRO.backgroundAccelerationMs
      );
      offsetRef.current = (progress * loopCount * tileHeight) % tileHeight;
      root.style.setProperty('--coordinator-intro-stencil-offset', `${offsetRef.current}px`);
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [stage]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'landing') return;

    offsetRef.current = 0;
    root.style.setProperty('--coordinator-intro-stencil-offset', '0px');
    const handle = window.setTimeout(() => {
      finishOnce();
    }, COORDINATOR_ONBOARDING_INTRO.landingDurationMs);

    return () => window.clearTimeout(handle);
  }, [finishOnce, stage]);

  return (
    <div
      ref={rootRef}
      className="brand-page-stencil-bg coordinator-onboarding-intro-bg flex h-full w-full items-center justify-center overflow-hidden bg-background"
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
        transition={{ duration: 0 }}
        className="flex items-center justify-center"
      >
        <div className="relative h-32 w-32">
          <MartyCallAvatar
            animateBodyMotion={false}
            className="drop-shadow-sm"
            creatureClassName="h-28 w-28"
            isSpeaking={stage === 'speaking' || stage === 'flying'}
            layoutTransition={COORDINATOR_ONBOARDING_MARTY_LAYOUT_TRANSITION}
            layoutId="marty-onboarding-call-avatar"
            speechLevel={COORDINATOR_ONBOARDING_INTRO.audioSrc ? audioSpeechLevel : undefined}
          />
        </div>
      </motion.div>
    </div>
  );
}
