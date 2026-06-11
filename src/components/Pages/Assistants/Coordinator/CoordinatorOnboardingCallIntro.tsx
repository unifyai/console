'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Lipsync } from 'wawa-lipsync';
import { DroidCallAvatar } from '@/components/Pages/Assistants/Communication/DroidCallAvatar';
import {
  COORDINATOR_ONBOARDING_INTRO,
  COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION,
} from '@/utils/assistants/coordinator-onboarding-intro';
import type { CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { getDroidLipsyncFrame } from '@/utils/assistants/droid-lipsync';

type IntroStage = 'pause' | 'speaking' | 'flying' | 'landing';
type LipsyncInternals = {
  audioContext: AudioContext;
};
type BrowserWindowWithCoordinatorIntroAudio = Window & {
  __coordinatorOnboardingIntroAudio?: HTMLAudioElement;
  __coordinatorOnboardingIntroSpeechLevel?: number;
  __coordinatorOnboardingIntroMouthShape?: CreatureMouthShape;
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

function getVisualHandoffOffsetMs(durationMs: number) {
  return Math.max(
    COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs + 500,
    durationMs - COORDINATOR_ONBOARDING_INTRO.handoffLeadMs
  );
}

export function CoordinatorOnboardingCallIntro({
  initialAvatarOffset,
  onReadyToStartCall,
  onFinished,
}: CoordinatorOnboardingCallIntroProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const offsetRef = React.useRef(0);
  const onReadyToStartCallRef = React.useRef(onReadyToStartCall);
  const onFinishedRef = React.useRef(onFinished);
  const hasStartedCallRef = React.useRef(false);
  const hasFinishedRef = React.useRef(false);
  const keepAudioAfterUnmountRef = React.useRef(false);
  const [stage, setStage] = React.useState<IntroStage>('pause');
  const [audioSpeechLevel, setAudioSpeechLevel] = React.useState(0);
  const [audioMouthShape, setAudioMouthShape] = React.useState<CreatureMouthShape>('closed');

  React.useEffect(() => {
    onReadyToStartCallRef.current = onReadyToStartCall;
    onFinishedRef.current = onFinished;
  }, [onFinished, onReadyToStartCall]);

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
    const { durationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs);
    const callWarmupOffsetMs = Math.max(
      0,
      handoffOffsetMs - COORDINATOR_ONBOARDING_INTRO.callWarmupLeadMs
    );
    const speakingStartTimer = window.setTimeout(
      () => setStage('speaking'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs
    );
    const backgroundStartTimer = window.setTimeout(
      () => setStage((currentStage) => (currentStage === 'speaking' ? 'flying' : currentStage)),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs +
        COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs
    );
    const callWarmupTimer = window.setTimeout(
      () => startCallOnce(),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + callWarmupOffsetMs
    );
    const landingTimer = window.setTimeout(
      () => setStage('landing'),
      COORDINATOR_ONBOARDING_INTRO.initialPauseMs + handoffOffsetMs
    );
    let audio: HTMLAudioElement | null = null;
    let audioTimer: number | null = null;
    let lipsync: Lipsync | null = null;
    let animationFrame = 0;
    let smoothedLevel = 0;
    let hasStartedAudio = false;
    let shouldPublishToComponent = true;

    const stopAudioAnalysis = (resetSpeechLevel = true) => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      smoothedLevel = 0;
      const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
      coordinatorWindow.__coordinatorOnboardingIntroSpeechLevel = 0;
      coordinatorWindow.__coordinatorOnboardingIntroMouthShape = 'closed';
      if (resetSpeechLevel) {
        setAudioSpeechLevel(0);
        setAudioMouthShape('closed');
      }
    };

    const startAudioAnalysis = (audioElement: HTMLAudioElement) => {
      lipsync = new Lipsync({ fftSize: 2048, historySize: 12 });
      lipsync.connectAudio(audioElement);

      const tick = () => {
        if (!lipsync) return;
        lipsync.processAudio();
        const frame = getDroidLipsyncFrame(lipsync.viseme, lipsync.features?.volume ?? 0);
        smoothedLevel = smoothedLevel * 0.72 + frame.speechLevel * 0.28;
        const mouthShape =
          frame.isActive || smoothedLevel > 0.08
            ? frame.isActive
              ? frame.mouthShape
              : 'narrow'
            : 'closed';
        const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
        coordinatorWindow.__coordinatorOnboardingIntroSpeechLevel = smoothedLevel;
        coordinatorWindow.__coordinatorOnboardingIntroMouthShape = mouthShape;
        if (shouldPublishToComponent) {
          setAudioSpeechLevel(smoothedLevel);
          setAudioMouthShape(mouthShape);
        }
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
        (lipsync as unknown as LipsyncInternals | null)?.audioContext?.resume().catch(() => {});
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
          (lipsync as unknown as LipsyncInternals | null)?.audioContext?.close().catch(() => {});
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
      if (!keepAudioPlaying) {
        (lipsync as unknown as LipsyncInternals | null)?.audioContext?.close().catch(() => {});
      }
    };
  }, [startCallOnce]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || stage !== 'flying') return;

    const { durationMs } = getRuntimeTiming();
    const handoffOffsetMs = getVisualHandoffOffsetMs(durationMs);
    const motionDurationMs = Math.max(
      1,
      handoffOffsetMs - COORDINATOR_ONBOARDING_INTRO.backgroundStartDelayMs
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
          <DroidCallAvatar
            animateBodyMotion={false}
            className="drop-shadow-sm"
            creatureClassName="h-28 w-28"
            isSpeaking={stage === 'speaking' || stage === 'flying'}
            layoutTransition={COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION}
            layoutId="coordinator-onboarding-call-avatar"
            mouthShape={audioMouthShape}
            speechLevel={COORDINATOR_ONBOARDING_INTRO.audioSrc ? audioSpeechLevel : undefined}
          />
        </div>
      </motion.div>
    </div>
  );
}
