'use client';

/**
 * CoordinatorOnboarding — the transient call-vs-chat picker that greets a
 * workspace owner whose Coordinator/State is in ``onboarding`` mode and who
 * hasn't yet resolved the picker.
 *
 * It renders as a full-screen overlay on top of the regular ``/assistants``
 * shell:
 *
 *   - **Picker** (``phase === 'picker'``): a centered call-vs-chat prompt.
 *     Picking chat fires the chat session-start event and dismisses the
 *     overlay immediately, dropping the user into the regular platform with
 *     the Coordinator selected. Picking call advances to audio setup.
 *
 *   - **Preparing** (``phase === 'preparing'``): the live call is connected
 *     over a brief loading state, then the overlay clears straight into the
 *     docked call where Twin greets naturally.
 *
 * There is no post-picker shell — the onboarding checklist lives in the
 * Coordinator's "Assistant info" panel on the regular platform once the
 * overlay clears.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Phone } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import {
  SeatedCoordinatorDroid,
  useCoordinatorDroidLayout,
} from '@/components/Pages/Assistants/Coordinator/SeatedCoordinatorDroid';
import { COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID } from '@/utils/assistants/coordinator-onboarding-intro';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { notifyOnboardingSessionStarted } from '@/lib/client/coordinator';
import type { Assistant, AssistantCallConnectOptions } from '@/types/assistants/assistant';
import { toast } from 'sonner';

type OnboardingPhase = 'picker' | 'preparing';

interface CoordinatorOnboardingProps {
  coordinator: Assistant;
  /** Starts the real Coordinator call so the docked call is already live in
   * the platform when the picker overlay dismisses. */
  onStartCall: (
    assistant: Assistant,
    callType: 'video' | 'audio',
    options?: AssistantCallConnectOptions
  ) => Promise<void> | void;
  /** Cancels a partially-started call when the call setup fails. */
  onDiscardCall: () => Promise<void> | void;
  /** Invoked once the picker is resolved. The parent tears down the overlay
   * and reveals the regular platform underneath. ``medium`` lets the parent
   * react to the path taken — e.g. surfacing the "Talk now!" cue over the
   * docked call once the call connects. */
  onComplete: (medium: 'call' | 'chat') => void;
}

export function CoordinatorOnboarding({
  coordinator,
  onStartCall,
  onDiscardCall,
  onComplete,
}: CoordinatorOnboardingProps) {
  const { updateState } = useCoordinatorOnboarding(coordinator.agentId);
  // Voice calls require LiveKit (Console-owned). Without it the picker's
  // "Start Call" is shown disabled (with a reason) and chat is the only path.
  const { voiceCalls } = useFeatures();

  const [phase, setPhase] = React.useState<OnboardingPhase>('picker');
  const [isStartingCall, setIsStartingCall] = React.useState(false);
  const hasCompletedRef = React.useRef(false);

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
      // Latch ``intro_watched`` so reloads never re-show the picker.
      void updateState({ introWatched: true });
      onComplete(medium);
    },
    [onComplete, updateState]
  );

  const requestMicrophoneAccess = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) return;

    const stream = await mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }, []);

  const handleStartCall = React.useCallback(async () => {
    if (phase !== 'picker') return;
    setPhase('preparing');
    setIsStartingCall(true);

    try {
      await requestMicrophoneAccess();
    } catch (error) {
      console.error('[CoordinatorOnboarding] Failed to access microphone:', error);
      toast.error('Microphone access is required to start the call.');
      setIsStartingCall(false);
      setPhase('picker');
      return;
    }

    try {
      await onStartCall(coordinator, 'audio', { suppressRinging: true });
    } catch (error) {
      console.error('[CoordinatorOnboarding] Failed to start the call:', error);
      toast.error('Could not start the call. Please try again.');
      await onDiscardCall();
      setIsStartingCall(false);
      setPhase('picker');
      return;
    }

    notifySessionStarted('call');
    complete('call');
  }, [
    complete,
    coordinator,
    notifySessionStarted,
    onDiscardCall,
    onStartCall,
    phase,
    requestMicrophoneAccess,
  ]);

  const handlePickChat = React.useCallback(() => {
    if (phase !== 'picker') return;
    notifySessionStarted('chat');
    complete('chat');
  }, [complete, notifySessionStarted, phase]);

  if (phase === 'preparing') {
    return (
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background"
        data-testid="coordinator-onboarding"
      >
        <CoordinatorOnboardingCallPreparing />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background"
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

/* ─── "Talk now!" cue ─────────────────────────────────────────────────── */

/**
 * Full-screen cue shown briefly once the onboarding picker hands off to a
 * live call, confirming the call is connected and Twin is listening.
 * Rendered at the platform level (over the docked call) since the picker
 * overlay has already torn down by this point.
 */
export function CoordinatorTalkNowCue({
  show,
  onDismiss,
}: {
  show: boolean;
  onDismiss?: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="bg-background/55 fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-6 backdrop-blur-md"
          data-testid="coordinator-onboarding-talk-now"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onClick={onDismiss}
        >
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-[18px] border-2 border-foreground bg-[radial-gradient(circle_at_18%_10%,color-mix(in_srgb,var(--droid-glow)_42%,transparent),transparent_31%),radial-gradient(circle_at_94%_22%,color-mix(in_srgb,var(--neo-coral)_25%,transparent),transparent_28%),radial-gradient(circle_at_28%_102%,color-mix(in_srgb,var(--neo-amber)_32%,transparent),transparent_34%),linear-gradient(140deg,color-mix(in_srgb,var(--card)_88%,var(--background)),var(--card)),var(--brand-grain-texture)] bg-[length:auto,auto,auto,auto,128px_128px] p-8 text-center bg-blend-normal shadow-[0_10px_0_color-mix(in_srgb,var(--foreground)_18%,transparent),0_34px_90px_color-mix(in_srgb,var(--foreground)_18%,transparent)]"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
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

/* ─── Call preparing ──────────────────────────────────────────────────── */

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
            Twin will start once the call is connected.
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
  onStartCall: () => void;
  onPickChat: () => void;
  isStartingCall: boolean;
}

function CoordinatorOnboardingPicker({
  voiceCalls,
  onStartCall,
  onPickChat,
  isStartingCall,
}: CoordinatorOnboardingPickerProps) {
  const { droidWidth, framePx } = useCoordinatorDroidLayout();
  // How far the card slides up under the droid so the two read as one
  // unit. Scaled to the droid so the overlap holds across viewport sizes.
  const cardOverlapPx = Math.round(droidWidth * 0.22);

  const startCallButton = (
    <Button
      size="lg"
      onClick={onStartCall}
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
      <div className="relative z-10" style={{ width: framePx, height: framePx }}>
        <SeatedCoordinatorDroid
          droid={COORDINATOR_ONBOARDING_DEFAULT_INITIAL_DROID}
          width={droidWidth}
          isSpeaking={false}
        />
      </div>
      {/* The prompt + actions live in a frosted card so the copy stays
       * legible in both light and dark themes. The card tucks up under the
       * droid (which sits on top via ``z-10``) so the avatar and panel read
       * as a single unit. */}
      <div
        className="coordinator-onboarding-card relative flex w-full flex-col items-center gap-6 rounded-2xl border border-border px-8 pb-7 shadow-xl"
        style={{ marginTop: -cardOverlapPx, paddingTop: cardOverlapPx + 24 }}
      >
        <p className="text-h3 font-medium text-card-foreground">
          {voiceCalls ? 'Twin is calling to onboard you' : 'Start onboarding with Twin'}
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
