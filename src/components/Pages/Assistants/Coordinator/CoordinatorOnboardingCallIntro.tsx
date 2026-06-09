'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { MartyCallAvatar } from '@/components/Pages/Assistants/Communication/MartyCallAvatar';
import { COORDINATOR_ONBOARDING_INTRO } from '@/utils/assistants/coordinator-onboarding-intro';

type IntroStage = 'pause' | 'speaking' | 'landing';
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

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
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
        const level = Math.max(0, Math.min(1, (rms - 0.018) * 7.8));
        smoothedLevel = smoothedLevel * 0.58 + level * 0.42;
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
    if (!root || stage !== 'speaking') return;

    const computed = window.getComputedStyle(root);
    const tileHeight = parseStencilTileHeight(computed.getPropertyValue('--chat-maze-size'));
    let previousTimestamp: number | null = null;
    let animationFrame = 0;

    const tick = (timestamp: number) => {
      if (previousTimestamp === null) previousTimestamp = timestamp;
      const elapsedSeconds = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;
      offsetRef.current =
        (offsetRef.current +
          elapsedSeconds * COORDINATOR_ONBOARDING_INTRO.backgroundPixelsPerSecond) %
        tileHeight;
      root.style.setProperty('--coordinator-intro-stencil-offset', `${offsetRef.current}px`);
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [stage]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'landing') return;

    const computed = window.getComputedStyle(root);
    const tileHeight = parseStencilTileHeight(computed.getPropertyValue('--chat-maze-size'));
    const startOffset = offsetRef.current;
    const endOffset = tileHeight;
    const duration = COORDINATOR_ONBOARDING_INTRO.landingDurationMs;
    let startTimestamp: number | null = null;
    let animationFrame = 0;

    const tick = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = Math.min(1, (timestamp - startTimestamp) / duration);
      const nextOffset = startOffset + (endOffset - startOffset) * easeOutCubic(progress);
      root.style.setProperty('--coordinator-intro-stencil-offset', `${nextOffset}px`);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      offsetRef.current = 0;
      root.style.setProperty('--coordinator-intro-stencil-offset', '0px');
      finishOnce();
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [finishOnce, stage]);

  return (
    <div
      ref={rootRef}
      className="brand-page-stencil-bg coordinator-onboarding-intro-bg flex h-full w-full items-center justify-center overflow-hidden bg-background"
      data-background-motion={
        stage === 'pause' ? 'idle' : stage === 'speaking' ? 'scrolling' : 'landing'
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
            isSpeaking={stage === 'speaking'}
            layoutId="marty-onboarding-call-avatar"
            speechLevel={COORDINATOR_ONBOARDING_INTRO.audioSrc ? audioSpeechLevel : undefined}
          />
        </div>
      </motion.div>
    </div>
  );
}
