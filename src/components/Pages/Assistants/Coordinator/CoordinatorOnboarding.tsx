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
 *     Coordinator selected. Starting a call advances to the intro.
 *
 *   - **Intro** (``phase === 'intro'``): the animated Marty intro.
 *     It warms up the real call early (``onStartCall``) so by the
 *     time the animation lands the docked call is already live in the
 *     platform's right pane underneath; the overlay then dismisses.
 *
 * There is no skip affordance and no post-intro shell — the onboarding
 * checklist lives in the Coordinator's "Assistant info" panel on the
 * regular platform once the overlay clears.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Phone, Radio, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import {
  SeatedCoordinatorDroid,
  useCoordinatorDroidLayout,
} from '@/components/Pages/Assistants/Coordinator/SeatedCoordinatorDroid';
import {
  CoordinatorOnboardingCallIntro,
  primeCoordinatorOnboardingCitySoundscape,
  startCoordinatorOnboardingBackgroundMusic,
  stopCoordinatorOnboardingBackgroundMusic,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingCallIntro';
import {
  COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID,
  COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT,
  getCoordinatorIntroCountdownMs,
} from '@/utils/assistants/coordinator-onboarding-intro';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { useCallSounds } from '@/hooks/Assistants/useCallSounds';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { notifyOnboardingSessionStarted } from '@/lib/client/coordinator';
import type { Assistant, AssistantCallConnectOptions } from '@/types/assistants/assistant';
import { toast } from 'sonner';

type OnboardingPhase = 'picker' | 'intro';
type CallStartFailureBehavior = 'picker' | 'dismiss';
type IntroAvatarOffset = { x: number; y: number };

interface CoordinatorOnboardingProps {
  coordinator: Assistant;
  /** When true the overlay mounts straight into the animated intro
   * (skipping the call-vs-chat picker) — used by the "Repeat intro"
   * affordance on the Coordinator's "Assistant info" card. */
  autoStartIntro?: boolean;
  /** Starts the real Coordinator call. The intro warms this up early so
   * the docked call is already live in the platform when the overlay
   * dismisses. */
  onStartCall: (
    assistant: Assistant,
    callType: 'video' | 'audio',
    options?: AssistantCallConnectOptions
  ) => Promise<void> | void;
  /** Invoked once the picker is resolved (chat) or the intro finishes
   * (call). The parent tears down the overlay and reveals the regular
   * platform underneath. ``medium`` lets the parent react to the path
   * taken — e.g. surfacing the "Talk now!" cue over the docked call once
   * the intro hands off to a live call. */
  onComplete: (medium: 'call' | 'chat') => void;
}

export function CoordinatorOnboarding({
  coordinator,
  autoStartIntro = false,
  onStartCall,
  onComplete,
}: CoordinatorOnboardingProps) {
  const { updateState } = useCoordinatorOnboarding(coordinator.agentId);
  // Voice calls require LiveKit (Console-owned). Without it the picker's
  // "Start Call" is shown disabled (with a reason) and chat is the only path.
  const { voiceCalls } = useFeatures();

  const [phase, setPhase] = React.useState<OnboardingPhase>(autoStartIntro ? 'intro' : 'picker');
  const [introAvatarOffset, setIntroAvatarOffset] = React.useState<IntroAvatarOffset>({
    x: 0,
    y: -72,
  });
  const [introSkipSignal, setIntroSkipSignal] = React.useState(0);
  const [isIntroTimelineReady, setIsIntroTimelineReady] = React.useState(false);
  // Pre-recorded intro countdown badge. ``introStartedAt`` anchors the
  // countdown clock; ``introCountdownMs`` is the wall-clock span until
  // Marty stops speaking; ``introReady`` flips when the intro finishes
  // so the badge stops counting.
  const [introStartedAt, setIntroStartedAt] = React.useState<number | null>(null);
  const [introCountdownMs, setIntroCountdownMs] = React.useState(0);
  const [introReady, setIntroReady] = React.useState(false);
  const [isStartingCall, setIsStartingCall] = React.useState(false);
  const isBeginningIntroRef = React.useRef(false);
  const hasTriggeredCallStartRef = React.useRef(false);
  const hasCompletedRef = React.useRef(false);

  const { startRinging: startPickerRinging, stopRinging: stopPickerRinging } = useCallSounds();
  const isPickerVisible = phase === 'picker';

  React.useEffect(() => {
    startCoordinatorOnboardingBackgroundMusic();
    return stopCoordinatorOnboardingBackgroundMusic;
  }, []);

  React.useEffect(() => {
    if (!isPickerVisible) {
      stopPickerRinging();
      return;
    }
    startPickerRinging();
    return stopPickerRinging;
  }, [isPickerVisible, startPickerRinging, stopPickerRinging]);

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
    hasTriggeredCallStartRef.current = true;
    try {
      await onStartCall(coordinator, 'audio', {
        suppressRinging: true,
        openingConfig: {
          mode: 'simulated',
          simulatedUtterance: COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT,
          source: 'marty_onboarding_intro',
        },
      });
      notifySessionStarted('call');
    } catch (error) {
      console.error('[CoordinatorOnboarding] Failed to start intro call:', error);
      hasTriggeredCallStartRef.current = false;
      return false;
    }
    return true;
  }, [coordinator, onStartCall, notifySessionStarted]);

  const beginCallIntro = React.useCallback(
    async (failureBehavior: CallStartFailureBehavior) => {
      if (isBeginningIntroRef.current) return;
      isBeginningIntroRef.current = true;
      setIsStartingCall(true);
      try {
        try {
          await requestMicrophoneAccess();
        } catch (error) {
          console.error('[CoordinatorOnboarding] Failed to access microphone:', error);
          toast.error('Microphone access is required to start the call.');
          isBeginningIntroRef.current = false;
          if (failureBehavior === 'dismiss') {
            complete('chat');
          }
          return;
        }

        setIntroReady(false);
        setIntroStartedAt(null);
        setIntroCountdownMs(0);
        setIsIntroTimelineReady(false);
        setPhase('intro');
        startIntroTimeline();

        void triggerCoordinatorCallStart().then((started) => {
          if (started) return;
          if (failureBehavior === 'picker') {
            isBeginningIntroRef.current = false;
            setIntroReady(false);
            setIntroStartedAt(null);
            setIntroCountdownMs(0);
            setIsIntroTimelineReady(false);
            setPhase('picker');
            return;
          }
          complete('chat');
        });
      } finally {
        setIsStartingCall(false);
      }
    },
    [complete, requestMicrophoneAccess, startIntroTimeline, triggerCoordinatorCallStart]
  );

  // Replay path: warm up the soundscape on mount so the auto-started
  // intro has its audio buffers ready, matching the picker's "Start Call".
  React.useEffect(() => {
    if (!autoStartIntro) return;
    primeCoordinatorOnboardingCitySoundscape();
    void beginCallIntro('dismiss');
  }, [autoStartIntro, beginCallIntro]);

  const handleStartCall = React.useCallback(
    async (avatarOffset: IntroAvatarOffset) => {
      if (phase !== 'picker') return;
      startCoordinatorOnboardingBackgroundMusic();
      primeCoordinatorOnboardingCitySoundscape();
      setIntroAvatarOffset(avatarOffset);
      setIntroSkipSignal(0);
      await beginCallIntro('picker');
    },
    [beginCallIntro, phase]
  );

  // Restart the currently-playing intro from the top. Bumping
  // ``introStartedAt`` re-keys the intro element so its audio and
  // stage timers restart against the already-live call.
  const handleRestartIntro = React.useCallback(() => {
    startCoordinatorOnboardingBackgroundMusic();
    primeCoordinatorOnboardingCitySoundscape();
    setIntroSkipSignal(0);
    startIntroTimeline();
  }, [startIntroTimeline]);

  const handleSkipIntro = React.useCallback(() => {
    setIntroReady(true);
    setIntroSkipSignal((current) => current + 1);
  }, []);

  const handlePickChat = React.useCallback(() => {
    notifySessionStarted('chat');
    complete('chat');
  }, [complete, notifySessionStarted]);

  const introCountdownBadge = (
    <OnboardingIntroCountdownBadge
      startedAt={introStartedAt}
      totalMs={introCountdownMs}
      ready={introReady}
      onRestart={handleRestartIntro}
      onSkip={handleSkipIntro}
    />
  );

  if (isPickerVisible) {
    return (
      <div
        className="brand-page-stencil-bg coordinator-onboarding-city-bg flex h-full w-full items-center justify-center overflow-hidden bg-background"
        data-testid="coordinator-onboarding"
      >
        <CoordinatorOnboardingPicker
          voiceCalls={voiceCalls}
          onStartCall={handleStartCall}
          onPickChat={handlePickChat}
          isStartingCall={isStartingCall}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background"
      data-testid="coordinator-onboarding"
    >
      <AnimatePresence mode="wait">
        <CoordinatorOnboardingCallIntro
          key={introStartedAt ?? 'intro'}
          initialAvatarOffset={introAvatarOffset}
          timelineEnabled={isIntroTimelineReady}
          onFinished={() => complete('call')}
          skipSignal={introSkipSignal}
          onSkipped={() => setIntroReady(true)}
          controlOverlay={introCountdownBadge}
        />
      </AnimatePresence>
    </div>
  );
}

/* ─── "Talk now!" cue ─────────────────────────────────────────────────── */

/**
 * Full-screen cue shown briefly once the onboarding intro hands off to a
 * live call, prompting the user that the pre-recorded intro is over and
 * Marty is now listening. Rendered at the platform level (over the docked
 * call) since the intro overlay has already torn down by this point.
 */
export function CoordinatorTalkNowCue({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="bg-background/80 pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-6 backdrop-blur-md"
          data-testid="coordinator-onboarding-talk-now"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
        >
          <motion.div
            aria-hidden="true"
            className="bg-role-teal/25 absolute -left-16 top-20 h-56 w-56 rounded-full blur-3xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            aria-hidden="true"
            className="bg-role-orange/25 absolute -right-20 bottom-16 h-64 w-64 rounded-full blur-3xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative w-full max-w-xl"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              aria-hidden="true"
              className="bg-role-orange/60 absolute inset-0 translate-x-2 translate-y-2 rounded-2xl"
            />
            <div className="bg-card/95 relative overflow-hidden rounded-2xl border-2 border-foreground p-8 text-center shadow-2xl">
              <div
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-foreground bg-card"
              />
              <div aria-hidden="true" className="absolute left-7 top-6 grid grid-cols-2 gap-1">
                <span className="h-3 w-3 rounded-sm bg-role-teal" />
                <span className="h-3 w-3 rounded-sm bg-role-pink" />
                <span className="h-3 w-3 rounded-sm bg-role-orange" />
                <span className="h-3 w-3 rounded-sm bg-role-yellow" />
              </div>
              <div aria-hidden="true" className="absolute right-8 top-8 flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-role-cyan" />
                <span className="h-2.5 w-2.5 rounded-full bg-role-purple" />
                <span className="h-2.5 w-2.5 rounded-full bg-role-green" />
              </div>
              <div className="bg-primary/15 relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-foreground text-primary">
                <motion.span
                  aria-hidden="true"
                  className="bg-primary/30 absolute inset-0 rounded-full"
                  initial={{ scale: 1, opacity: 0.65 }}
                  animate={{ scale: 1.75, opacity: 0 }}
                  transition={{ duration: 1.25, ease: 'easeOut', repeat: Infinity }}
                />
                <Mic className="relative h-12 w-12" aria-hidden="true" />
              </div>
              <p className="text-h1 font-semibold text-foreground">Talk now!</p>
              <p className="text-body mt-2 text-muted-foreground">Marty is listening.</p>
            </div>
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
 * Badge that signals the opening call is a pre-recorded intro the user can't
 * talk over yet: while Marty speaks it shows "Intro" with a live countdown to
 * when he finishes. ``startedAt === null`` keeps it fully hidden (e.g. before
 * the intro begins).
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

  const remainingSeconds = Math.ceil(Math.max(0, totalMs - elapsedMs) / 1000);
  const showRestart = !!onRestart;

  const iconButtonClass =
    'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

  return (
    <div
      className="pointer-events-none"
      data-testid="coordinator-onboarding-intro-countdown"
      data-state={isReady ? 'ready' : 'counting'}
    >
      <TooltipProvider>
        <div className="bg-card/80 flex items-center rounded-full border border-border px-2 py-1.5 text-card-foreground shadow-lg backdrop-blur-md">
          <Radio className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-label ml-2 font-semibold">Intro</span>
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
          {voiceCalls ? 'Marty is calling to onboard you' : 'Start onboarding with Marty'}
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
