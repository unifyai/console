'use client';

/**
 * CoordinatorOnboarding — the transient call-vs-chat picker + animated
 * intro that greets a workspace owner whose Coordinator/State is in
 * ``onboarding`` mode and who hasn't yet watched the intro.
 *
 * It renders as a full-screen overlay on top of the regular
 * ``/assistants`` shell:
 *
 *   - **Picker** (``phase === 'picker'``): a centered call-vs-chat
 *     prompt over the city backdrop. Picking chat fires the chat
 *     session-start event and dismisses the overlay immediately,
 *     dropping the user into the regular platform with the
 *     Coordinator selected. Starting a call advances to audio setup.
 *
 *   - **Preparing** (``phase === 'preparing'``): the real call is warmed
 *     before Twin starts speaking so browser audio-device handoffs happen
 *     over the loading state instead of the prerecorded intro.
 *
 *   - **Intro** (``phase === 'intro'``): the animated Twin intro. If audio
 *     remains enabled when the animation lands, the call docks in the
 *     platform's right pane; muting the intro discards the warmed call and
 *     hands off to chat.
 *
 * There is no skip affordance and no post-intro shell — the onboarding
 * checklist lives in the Coordinator's "Assistant info" panel on the
 * regular platform once the overlay clears.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Phone, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import {
  SeatedCoordinatorDroid,
  useCoordinatorDroidLayout,
} from '@/components/Pages/Assistants/Coordinator/SeatedCoordinatorDroid';
import {
  CoordinatorOnboardingCallIntro,
  getCoordinatorOnboardingBackgroundMusicEnabled,
  primeCoordinatorOnboardingCitySoundscape,
  primeCoordinatorOnboardingIntroVoice,
  setCoordinatorOnboardingBackgroundMusicEnabled,
  startCoordinatorOnboardingBackgroundMusic,
  stopCoordinatorOnboardingBackgroundMusic,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingCallIntro';
import {
  COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID,
  COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT,
  getCoordinatorIntroCountdownMs,
} from '@/utils/assistants/coordinator-onboarding-intro';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { notifyOnboardingSessionStarted } from '@/lib/client/coordinator';
import {
  injectAssistantVoiceTurn,
  setAssistantProactiveSpeech,
} from '@/lib/client/assistant-voice-control';
import type { Assistant, AssistantCallConnectOptions } from '@/types/assistants/assistant';
import { toast } from 'sonner';

type OnboardingPhase = 'picker' | 'preparing' | 'intro';
type IntroMedium = 'call' | 'chat';
type IntroAvatarOffset = { x: number; y: number };

interface CoordinatorOnboardingProps {
  coordinator: Assistant;
  /** Starts the real Coordinator call so the docked call is already live in
   * the platform when the intro overlay dismisses. */
  onStartCall: (
    assistant: Assistant,
    callType: 'video' | 'audio',
    options?: AssistantCallConnectOptions
  ) => Promise<void> | void;
  /** Cancels the warmed call when the intro finishes in text mode. */
  onDiscardCall: () => Promise<void> | void;
  /** Invoked once the picker is resolved (chat) or the intro finishes
   * (call). The parent tears down the overlay and reveals the regular
   * platform underneath. ``medium`` lets the parent react to the path
   * taken — e.g. surfacing the "Talk now!" cue over the docked call once
   * the intro hands off to a live call. */
  onComplete: (medium: 'call' | 'chat') => void;
  /** Reveals the platform beneath the intro while keeping the intro droid visible. */
  onRevealSurface?: () => void;
}

export function CoordinatorOnboarding({
  coordinator,
  onStartCall,
  onDiscardCall,
  onComplete,
  onRevealSurface,
}: CoordinatorOnboardingProps) {
  const { updateState } = useCoordinatorOnboarding(coordinator.agentId);
  // Voice calls require LiveKit (Console-owned). Without it the picker's
  // "Start Call" is shown disabled (with a reason) and chat is the only path.
  const { voiceCalls } = useFeatures();

  const [phase, setPhase] = React.useState<OnboardingPhase>('picker');
  const [introMedium, setIntroMedium] = React.useState<IntroMedium>('call');
  const [introAvatarOffset, setIntroAvatarOffset] = React.useState<IntroAvatarOffset>({
    x: 0,
    y: -72,
  });
  const [introSkipSignal, setIntroSkipSignal] = React.useState(0);
  const [isIntroTimelineReady, setIsIntroTimelineReady] = React.useState(false);
  // Pre-recorded intro countdown badge. ``introStartedAt`` anchors the
  // countdown clock; ``introCountdownMs`` is the wall-clock span until
  // Twin stops speaking; ``introReady`` flips when the intro finishes
  // so the badge stops counting.
  const [introStartedAt, setIntroStartedAt] = React.useState<number | null>(null);
  const [introCountdownMs, setIntroCountdownMs] = React.useState(0);
  const [introReady, setIntroReady] = React.useState(false);
  const [surfaceVisible, setSurfaceVisible] = React.useState(false);
  const [isStartingCall, setIsStartingCall] = React.useState(false);
  const isBeginningIntroRef = React.useRef(false);
  const hasTriggeredCallStartRef = React.useRef(false);
  const hasCompletedRef = React.useRef(false);
  const introMediumRef = React.useRef(introMedium);
  const warmCallCancelledRef = React.useRef(false);
  const callStartPromiseRef = React.useRef<Promise<boolean> | null>(null);
  const callAudioReadyRef = React.useRef(false);

  const isPickerVisible = phase === 'picker';

  introMediumRef.current = introMedium;

  React.useEffect(() => {
    startCoordinatorOnboardingBackgroundMusic();
    return stopCoordinatorOnboardingBackgroundMusic;
  }, []);

  // Fire the picker-resolution event so Droid opens the session with the
  // right kind of message. Best-effort: completion never blocks on it.
  const notifySessionStarted = React.useCallback(
    (medium: 'chat' | 'call') => {
      void notifyOnboardingSessionStarted(coordinator.agentId, medium);
    },
    [coordinator.agentId]
  );

  const complete = React.useCallback(
    (medium: 'call' | 'chat') => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      // Latch ``intro_watched`` so reloads never re-show the picker / intro.
      void updateState({ introWatched: true });
      onComplete(medium);
    },
    [onComplete, updateState]
  );

  const startIntroTimeline = React.useCallback(() => {
    setIntroReady(false);
    setIntroStartedAt(Date.now());
    setIntroCountdownMs(getCoordinatorIntroCountdownMs());
    setIsIntroTimelineReady(true);
  }, []);

  const requestMicrophoneAccess = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) return;

    const stream = await mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }, []);

  const triggerCoordinatorCallStart = React.useCallback(async () => {
    if (hasTriggeredCallStartRef.current) return true;
    if (callStartPromiseRef.current) return callStartPromiseRef.current;

    const startPromise = (async () => {
      hasTriggeredCallStartRef.current = true;
      try {
        await onStartCall(coordinator, 'audio', {
          suppressRinging: true,
          openingConfig: {
            mode: 'silent',
            source: 'twin_onboarding_intro',
          },
        });
      } catch (error) {
        console.error('[CoordinatorOnboarding] Failed to start intro call:', error);
        hasTriggeredCallStartRef.current = false;
        return false;
      } finally {
        callStartPromiseRef.current = null;
      }
      return true;
    })();

    callStartPromiseRef.current = startPromise;
    return startPromise;
  }, [coordinator, onStartCall]);

  const warmCoordinatorCallStart = React.useCallback(async () => {
    if (!voiceCalls) return false;
    callAudioReadyRef.current = false;
    try {
      await requestMicrophoneAccess();
    } catch (error) {
      console.error('[CoordinatorOnboarding] Failed to access microphone:', error);
      toast.error('Microphone access is required to start the call.');
      return false;
    }
    if (warmCallCancelledRef.current || hasCompletedRef.current) return false;
    const started = await triggerCoordinatorCallStart();
    if (!started) {
      toast.error('Could not start the call. Please try again.');
    }
    if (started && !warmCallCancelledRef.current && !hasCompletedRef.current) {
      callAudioReadyRef.current = true;
      void setAssistantProactiveSpeech(coordinator.agentId, false, {
        source: 'twin_onboarding_intro',
        reason: 'prerecorded_intro',
      });
    }
    return started;
  }, [coordinator.agentId, requestMicrophoneAccess, triggerCoordinatorCallStart, voiceCalls]);

  const beginIntro = React.useCallback(
    async (medium: IntroMedium) => {
      if (isBeginningIntroRef.current) return;
      isBeginningIntroRef.current = true;
      setIsStartingCall(true);
      let introStarted = false;
      try {
        warmCallCancelledRef.current = false;
        callAudioReadyRef.current = false;
        introMediumRef.current = medium;
        setIntroMedium(medium);
        setIntroReady(false);
        setIntroStartedAt(null);
        setIntroCountdownMs(0);
        setIsIntroTimelineReady(false);
        setSurfaceVisible(false);

        if (medium === 'call') {
          setPhase('preparing');
          const warmed = await warmCoordinatorCallStart();
          if (!warmed) {
            warmCallCancelledRef.current = true;
            hasTriggeredCallStartRef.current = false;
            callStartPromiseRef.current = null;
            void setAssistantProactiveSpeech(coordinator.agentId, true, {
              source: 'twin_onboarding_intro',
              reason: 'intro_warmup_failed',
            });
            setPhase('picker');
            return;
          }
        }

        if (warmCallCancelledRef.current || hasCompletedRef.current) return;
        setPhase('intro');
        startIntroTimeline();
        introStarted = true;
      } finally {
        setIsStartingCall(false);
        if (!introStarted) isBeginningIntroRef.current = false;
      }
    },
    [coordinator.agentId, startIntroTimeline, warmCoordinatorCallStart]
  );

  const handleStartCall = React.useCallback(
    async (avatarOffset: IntroAvatarOffset) => {
      if (phase !== 'picker') return;
      startCoordinatorOnboardingBackgroundMusic();
      primeCoordinatorOnboardingCitySoundscape();
      primeCoordinatorOnboardingIntroVoice();
      setIntroAvatarOffset(avatarOffset);
      setIntroSkipSignal(0);
      await beginIntro('call');
    },
    [beginIntro, phase]
  );

  // Return to the lightweight picker so replaying the intro still begins with
  // an explicit call/text choice.
  const handleRestartIntro = React.useCallback(() => {
    startCoordinatorOnboardingBackgroundMusic();
    primeCoordinatorOnboardingCitySoundscape();
    isBeginningIntroRef.current = false;
    warmCallCancelledRef.current = true;
    callAudioReadyRef.current = false;
    hasTriggeredCallStartRef.current = false;
    callStartPromiseRef.current = null;
    setIsStartingCall(false);
    setPhase('picker');
    setIntroAvatarOffset({ x: 0, y: -72 });
    setIntroSkipSignal(0);
    setIntroReady(false);
    setIntroStartedAt(null);
    setIntroCountdownMs(0);
    setIsIntroTimelineReady(false);
    setSurfaceVisible(false);
    void onDiscardCall();
  }, [onDiscardCall]);

  const handleSkipIntro = React.useCallback(() => {
    setIntroReady(true);
    setIntroSkipSignal((current) => current + 1);
  }, []);

  const handleReadyToRevealSurface = React.useCallback(() => {
    setSurfaceVisible(true);
    onRevealSurface?.();
  }, [onRevealSurface]);

  const handlePickChat = React.useCallback(() => {
    if (phase !== 'picker') return;
    startCoordinatorOnboardingBackgroundMusic();
    primeCoordinatorOnboardingCitySoundscape();
    setIntroAvatarOffset({ x: 0, y: -72 });
    setIntroSkipSignal(0);
    void beginIntro('chat');
  }, [beginIntro, phase]);

  const handleIntroAudioToggle = React.useCallback(() => {
    setIntroMedium((current) => {
      const next = current === 'call' ? 'chat' : voiceCalls ? 'call' : 'chat';
      introMediumRef.current = next;
      setCoordinatorOnboardingBackgroundMusicEnabled(next === 'call');
      return next;
    });
  }, [voiceCalls]);

  const handleIntroFinished = React.useCallback(async () => {
    setIntroReady(true);

    if (introMediumRef.current === 'chat') {
      warmCallCancelledRef.current = true;
      await onDiscardCall();
      void setAssistantProactiveSpeech(coordinator.agentId, true, {
        source: 'twin_onboarding_intro',
        reason: 'intro_finished_in_chat',
      });
      notifySessionStarted('chat');
      complete('chat');
      return;
    }

    setIsStartingCall(true);
    try {
      if (!callAudioReadyRef.current) {
        try {
          await requestMicrophoneAccess();
        } catch (error) {
          console.error('[CoordinatorOnboarding] Failed to access microphone:', error);
          toast.error('Microphone access is required to start the call.');
          warmCallCancelledRef.current = true;
          await onDiscardCall();
          notifySessionStarted('chat');
          complete('chat');
          return;
        }
      }

      const started = callAudioReadyRef.current || (await triggerCoordinatorCallStart());
      if (started) {
        const injection = await injectAssistantVoiceTurn(
          coordinator.agentId,
          COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT,
          {
            source: 'twin_onboarding_intro',
            scheduleProactive: true,
          }
        );
        if (!injection.ok) {
          console.warn('[CoordinatorOnboarding] Failed to inject intro transcript:', injection);
        }
        void setAssistantProactiveSpeech(coordinator.agentId, true, {
          source: 'twin_onboarding_intro',
          reason: 'intro_handoff',
          scheduleNow: true,
        });
        notifySessionStarted('call');
        complete('call');
        return;
      }

      toast.error('Could not start the call. Continuing in chat.');
      warmCallCancelledRef.current = true;
      await onDiscardCall();
      void setAssistantProactiveSpeech(coordinator.agentId, true, {
        source: 'twin_onboarding_intro',
        reason: 'intro_call_failed',
      });
      notifySessionStarted('chat');
      complete('chat');
    } finally {
      setIsStartingCall(false);
    }
  }, [
    complete,
    coordinator.agentId,
    notifySessionStarted,
    onDiscardCall,
    requestMicrophoneAccess,
    triggerCoordinatorCallStart,
  ]);

  const introCountdownBadge = (
    <OnboardingIntroCountdownBadge
      startedAt={introStartedAt}
      totalMs={introCountdownMs}
      ready={introReady}
      onRestart={handleRestartIntro}
      onSkip={handleSkipIntro}
    />
  );
  const backgroundMusicSwitcher = <CoordinatorOnboardingAudioSwitcher />;
  const introSoundSwitcher = (
    <CoordinatorOnboardingAudioSwitcher
      enabled={introMedium === 'call'}
      onToggle={handleIntroAudioToggle}
      dataTestId="coordinator-onboarding-audio-switcher"
      label={introMedium === 'call' ? 'Mute intro audio' : 'Unmute intro audio'}
      title="volume"
    />
  );

  if (isPickerVisible) {
    return (
      <div
        className="brand-page-stencil-bg coordinator-onboarding-city-bg relative flex h-full w-full items-center justify-center overflow-hidden bg-background"
        data-testid="coordinator-onboarding"
      >
        <CoordinatorOnboardingPicker
          voiceCalls={voiceCalls}
          onStartCall={handleStartCall}
          onPickChat={handlePickChat}
          isStartingCall={isStartingCall}
        />
        {backgroundMusicSwitcher}
      </div>
    );
  }

  if (phase === 'preparing') {
    return (
      <div
        className="brand-page-stencil-bg coordinator-onboarding-city-bg relative flex h-full w-full items-center justify-center overflow-hidden bg-background"
        data-testid="coordinator-onboarding"
      >
        <CoordinatorOnboardingCallPreparing />
        {backgroundMusicSwitcher}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden',
        surfaceVisible ? 'bg-transparent' : 'bg-background'
      )}
      data-testid="coordinator-onboarding"
    >
      {introCountdownBadge}
      {voiceCalls && introSoundSwitcher}
      <AnimatePresence mode="wait">
        <CoordinatorOnboardingCallIntro
          key={introStartedAt ?? 'intro'}
          initialAvatarOffset={introAvatarOffset}
          timelineEnabled={isIntroTimelineReady}
          presentationMode={introMedium === 'call' ? 'voice' : 'text'}
          onReadyToRevealSurface={handleReadyToRevealSurface}
          onFinished={() => void handleIntroFinished()}
          skipSignal={introSkipSignal}
          onSkipped={() => setIntroReady(true)}
          surfaceVisible={surfaceVisible}
        />
      </AnimatePresence>
    </div>
  );
}

/* ─── "Talk now!" cue ─────────────────────────────────────────────────── */

/**
 * Full-screen cue shown briefly once the onboarding intro hands off to a
 * live call, prompting the user that the pre-recorded intro is over and
 * Twin is now listening. Rendered at the platform level (over the docked
 * call) since the intro overlay has already torn down by this point.
 */
export function CoordinatorTalkNowCue({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="bg-background/55 pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-6 backdrop-blur-md"
          data-testid="coordinator-onboarding-talk-now"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
        >
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-[18px] border-2 border-foreground bg-[radial-gradient(circle_at_18%_10%,color-mix(in_srgb,var(--droid-glow)_42%,transparent),transparent_31%),radial-gradient(circle_at_94%_22%,color-mix(in_srgb,var(--neo-coral)_25%,transparent),transparent_28%),radial-gradient(circle_at_28%_102%,color-mix(in_srgb,var(--neo-amber)_32%,transparent),transparent_34%),linear-gradient(140deg,color-mix(in_srgb,var(--card)_88%,var(--background)),var(--card)),var(--brand-grain-texture)] bg-[length:auto,auto,auto,auto,128px_128px] p-8 text-center bg-blend-normal shadow-[0_10px_0_color-mix(in_srgb,var(--foreground)_18%,transparent),0_34px_90px_color-mix(in_srgb,var(--foreground)_18%,transparent)]"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-card/70 relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-foreground text-primary shadow-md">
              <Mic className="h-12 w-12" aria-hidden="true" />
            </div>
            <p className="text-h1 relative font-semibold text-foreground">Talk now!</p>
            <p className="text-body relative mt-2 text-muted-foreground">Twin is listening.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Pre-recorded intro countdown badge ──────────────────────────────── */

function formatIntroCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Top-centre badge that signals the opening call is a pre-recorded intro the
 * user can't talk over yet: while Twin speaks it shows "Intro" with a live
 * countdown to when he finishes, then disappears. ``startedAt === null`` keeps
 * it fully hidden (e.g. before the intro begins).
 */
function OnboardingIntroCountdownBadge({
  startedAt,
  totalMs,
  ready,
  onRestart,
  onSkip,
}: {
  startedAt: number | null;
  totalMs: number;
  ready: boolean;
  onRestart?: () => void;
  onSkip?: () => void;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (startedAt === null) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return null;

  const elapsedMs = nowMs - startedAt;
  const isReady = ready || elapsedMs >= totalMs;
  if (isReady) return null;

  const remainingSeconds = Math.ceil(Math.max(0, totalMs - elapsedMs) / 1000);
  const showRestart = !!onRestart;

  const iconButtonClass =
    'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2"
      data-testid="coordinator-onboarding-intro-countdown"
      data-state="counting"
    >
      <TooltipProvider>
        <div className="bg-card/80 flex items-center rounded-full border border-border px-2 py-1.5 text-card-foreground shadow-lg backdrop-blur-md">
          <span className="text-label font-semibold">Intro</span>
          <span className="text-label ml-2 tabular-nums text-muted-foreground">
            {formatIntroCountdown(remainingSeconds)}
          </span>
          {(showRestart || onSkip) && <span className="mx-1.5 h-4 w-px bg-border" />}
          {showRestart && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Repeat intro"
                  onClick={onRestart}
                  className={iconButtonClass}
                  data-testid="coordinator-onboarding-intro-restart"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Repeat intro</TooltipContent>
            </Tooltip>
          )}
          {showRestart && onSkip && <span className="mx-0.5 h-4 w-px bg-border" />}
          {onSkip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Skip intro"
                  onClick={onSkip}
                  className={iconButtonClass}
                  data-testid="coordinator-onboarding-intro-skip"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Skip intro</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}

function CoordinatorOnboardingAudioSwitcher({
  enabled,
  onToggle,
  dataTestId = 'coordinator-onboarding-background-music-switcher',
  label,
  title = 'background music',
}: {
  enabled?: boolean;
  onToggle?: () => void;
  dataTestId?: string;
  label?: string;
  title?: string;
}) {
  const [uncontrolledEnabled, setUncontrolledEnabled] = React.useState(() =>
    getCoordinatorOnboardingBackgroundMusicEnabled()
  );
  const isEnabled = enabled ?? uncontrolledEnabled;

  const toggleMusic = React.useCallback(() => {
    if (onToggle) {
      onToggle();
      return;
    }
    setUncontrolledEnabled((current) => {
      const enabled = !current;
      setCoordinatorOnboardingBackgroundMusicEnabled(enabled);
      return enabled;
    });
  }, [onToggle]);

  const buttonClass = cn(
    'pointer-events-auto absolute bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/80 text-card-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    !isEnabled && 'text-muted-foreground'
  );

  return (
    <button
      aria-label={label ?? (isEnabled ? 'Turn background music off' : 'Turn background music on')}
      aria-pressed={!isEnabled}
      className={buttonClass}
      data-testid={dataTestId}
      onClick={toggleMusic}
      title={title}
      type="button"
    >
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-6 w-6">
        <path
          d="M4.4 9.2h3.1l4.8-4.1c.7-.6 1.7-.1 1.7.8v12.2c0 .9-1 1.4-1.7.8l-4.8-4.1H4.4c-.8 0-1.4-.6-1.4-1.4v-2.8c0-.8.6-1.4 1.4-1.4Z"
          fill="currentColor"
        />
        {isEnabled ? (
          <>
            <path
              d="M16.4 8.2c.9.9 1.4 2.2 1.4 3.8s-.5 2.9-1.4 3.8"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
            <path
              d="M18.9 5.8c1.4 1.5 2.2 3.6 2.2 6.2s-.8 4.7-2.2 6.2"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </>
        ) : (
          <path
            d="M18.7 7.3 7.1 18.9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
        )}
      </svg>
    </button>
  );
}

function CoordinatorOnboardingCallPreparing() {
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  const cardOverlapPx = Math.round(droidWidth * 0.22);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex w-full max-w-md flex-col items-center px-6 text-center"
      data-testid="coordinator-onboarding-call-preparing"
    >
      <div className="relative z-10" style={{ width: framePx, height: framePx }}>
        <SeatedCoordinatorDroid
          droid={COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID}
          width={droidWidth}
          isSpeaking={false}
        />
      </div>
      <div
        className="coordinator-onboarding-card relative flex w-full flex-col items-center gap-4 rounded-2xl border border-border px-8 pb-7 shadow-xl"
        style={{ marginTop: -cardOverlapPx, paddingTop: cardOverlapPx + 24 }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
        <div>
          <p className="text-h3 font-medium text-card-foreground">Getting your audio ready</p>
          <p className="text-body mt-2 text-muted-foreground">
            T-W1N will start once the call is connected.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Picker (Start Call / I'd rather text) ─────────────────────────────── */

interface CoordinatorOnboardingPickerProps {
  /** Whether voice calls are configured on this deployment (LiveKit). */
  voiceCalls: boolean;
  onStartCall: (avatarOffset: IntroAvatarOffset) => void;
  onPickChat: () => void;
  isStartingCall: boolean;
}

function CoordinatorOnboardingPicker({
  voiceCalls,
  onStartCall,
  onPickChat,
  isStartingCall,
}: CoordinatorOnboardingPickerProps) {
  const avatarRef = React.useRef<HTMLDivElement | null>(null);
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  // How far the card slides up under the droid so the two read as one
  // unit. Scaled to the droid so the overlap holds across viewport sizes.
  const cardOverlapPx = Math.round(droidWidth * 0.22);

  const handleStartCall = React.useCallback(() => {
    const rect = avatarRef.current?.getBoundingClientRect();
    const containerRect = avatarRef.current
      ?.closest('[data-testid="coordinator-onboarding"]')
      ?.getBoundingClientRect();
    const avatarOffset =
      rect && containerRect
        ? {
            x: rect.left + rect.width / 2 - (containerRect.left + containerRect.width / 2),
            y: rect.top + rect.height / 2 - (containerRect.top + containerRect.height / 2),
          }
        : { x: 0, y: -72 };
    onStartCall(avatarOffset);
  }, [onStartCall]);

  const startCallButton = (
    <Button
      size="lg"
      onClick={handleStartCall}
      disabled={isStartingCall || !voiceCalls}
      className={cn(!isStartingCall && voiceCalls && 'animate-onboarding-ring-pulse')}
      data-testid="coordinator-onboarding-start-call"
    >
      {isStartingCall ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Starting call…
        </>
      ) : (
        <>
          <Phone className="mr-2 h-4 w-4" />
          Start Call
        </>
      )}
    </Button>
  );

  return (
    <motion.div
      // Opacity-only entrance (no ``y``): a transform on this ancestor
      // would make the card's ``backdrop-filter`` sample an empty
      // backdrop, defeating the frosted-glass blur.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex w-full max-w-md flex-col items-center px-6 text-center"
      data-testid="coordinator-onboarding-picker"
    >
      <div ref={avatarRef} className="relative z-10" style={{ width: framePx, height: framePx }}>
        <SeatedCoordinatorDroid
          droid={COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID}
          width={droidWidth}
          isSpeaking={false}
        />
      </div>
      {/* The prompt + actions live in a frosted card so the copy stays
       * legible against the busy city backdrop in both light and dark
       * themes. The card tucks up under the droid (which sits on top via
       * ``z-10``) so the avatar and panel read as a single unit. */}
      <div
        className="coordinator-onboarding-card relative flex w-full flex-col items-center gap-6 rounded-2xl border border-border px-8 pb-7 shadow-xl"
        style={{ marginTop: -cardOverlapPx, paddingTop: cardOverlapPx + 24 }}
      >
        <p className="text-h3 font-medium text-card-foreground">
          {voiceCalls ? 'T-W1N is calling to onboard you' : 'Start onboarding with T-W1N'}
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          {voiceCalls ? (
            startCallButton
          ) : (
            // Keep the call option visible but disabled, with a reason. The span
            // wrapper lets the tooltip fire over the disabled button.
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{startCallButton}</span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Voice calls aren&apos;t enabled on this deployment</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="link"
            onClick={onPickChat}
            disabled={isStartingCall}
            data-testid="coordinator-onboarding-pick-chat"
          >
            I&apos;d rather text for now
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
