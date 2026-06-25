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
 *     and held until T-W1N signals that the opening turn is ready to play.
 *
 * There is no post-picker shell — the onboarding checklist lives in the
 * Coordinator's "Assistant info" panel on the regular platform once the
 * overlay clears.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import {
  SeatedCoordinatorUnity,
  useCoordinatorUnityLayout,
} from '@/components/Pages/Assistants/Coordinator/SeatedCoordinatorUnity';
import { COORDINATOR_ONBOARDING_DEFAULT_INITIAL_UNITY } from '@/utils/assistants/coordinator-onboarding-intro';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { notifyOnboardingSessionStarted } from '@/lib/client/coordinator';
import { debugConsole } from '@/lib/consoleDebug';
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
   * and reveals the regular platform underneath. */
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

  React.useEffect(() => {
    debugConsole('coordinator-onboarding', 'overlay.mount', {
      coordinatorId: coordinator.agentId,
      voiceCalls,
    });
    return () => {
      debugConsole('coordinator-onboarding', 'overlay.unmount', {
        coordinatorId: coordinator.agentId,
      });
    };
  }, [coordinator.agentId, voiceCalls]);

  React.useEffect(() => {
    debugConsole('coordinator-onboarding', 'overlay.phase', {
      coordinatorId: coordinator.agentId,
      phase,
      isStartingCall,
    });
  }, [coordinator.agentId, isStartingCall, phase]);

  // Fire the picker-resolution event so Unity opens the session with the
  // right kind of message. Best-effort: completion never blocks on it.
  const notifySessionStarted = React.useCallback(
    (medium: 'chat' | 'call') => {
      debugConsole('coordinator-onboarding', 'session-started.notify', {
        coordinatorId: coordinator.agentId,
        medium,
      });
      void notifyOnboardingSessionStarted(coordinator.agentId, medium);
    },
    [coordinator.agentId]
  );

  const complete = React.useCallback(
    (medium: 'call' | 'chat') => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      debugConsole('coordinator-onboarding', 'overlay.complete', {
        coordinatorId: coordinator.agentId,
        medium,
      });
      // Latch ``intro_watched`` so reloads never re-show the picker.
      void updateState({ introWatched: true });
      onComplete(medium);
    },
    [coordinator.agentId, onComplete, updateState]
  );

  const handleStartCall = React.useCallback(async () => {
    if (phase !== 'picker') return;
    debugConsole('coordinator-onboarding', 'start-call.click', {
      coordinatorId: coordinator.agentId,
    });
    setPhase('preparing');
    setIsStartingCall(true);

    try {
      await onStartCall(coordinator, 'audio', {
        suppressRinging: true,
        waitForAssistantReady: true,
        startMuted: true,
      });
    } catch (error) {
      debugConsole('coordinator-onboarding', 'start-call.failure', {
        coordinatorId: coordinator.agentId,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error('[CoordinatorOnboarding] Failed to start the call:', error);
      toast.error('Could not start the call. Please try again.');
      await onDiscardCall();
      setIsStartingCall(false);
      setPhase('picker');
      return;
    }

    debugConsole('coordinator-onboarding', 'start-call.ready', {
      coordinatorId: coordinator.agentId,
    });
    notifySessionStarted('call');
    complete('call');
  }, [complete, coordinator, notifySessionStarted, onDiscardCall, onStartCall, phase]);

  const handlePickChat = React.useCallback(() => {
    if (phase !== 'picker') return;
    debugConsole('coordinator-onboarding', 'pick-chat.click', {
      coordinatorId: coordinator.agentId,
    });
    notifySessionStarted('chat');
    complete('chat');
  }, [complete, coordinator.agentId, notifySessionStarted, phase]);

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

/* ─── Call preparing ──────────────────────────────────────────────────── */

function CoordinatorOnboardingCallPreparing() {
  const { unityWidth, framePx } = useCoordinatorUnityLayout();
  const cardOverlapPx = Math.round(unityWidth * 0.22);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex w-full max-w-md flex-col items-center px-6 text-center"
      data-testid="coordinator-onboarding-call-preparing"
    >
      <div className="relative z-10" style={{ width: framePx, height: framePx }}>
        <SeatedCoordinatorUnity
          unity={COORDINATOR_ONBOARDING_DEFAULT_INITIAL_UNITY}
          width={unityWidth}
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
            T-W1N will start speaking as soon as he is ready.
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
  const { unityWidth, framePx } = useCoordinatorUnityLayout();
  // How far the card slides up under the unity so the two read as one
  // unit. Scaled to the unity so the overlap holds across viewport sizes.
  const cardOverlapPx = Math.round(unityWidth * 0.22);

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
        <SeatedCoordinatorUnity
          unity={COORDINATOR_ONBOARDING_DEFAULT_INITIAL_UNITY}
          width={unityWidth}
          isSpeaking={false}
        />
      </div>
      {/* The prompt + actions live in a frosted card so the copy stays
       * legible in both light and dark themes. The card tucks up under the
       * unity (which sits on top via ``z-10``) so the avatar and panel read
       * as a single unit. */}
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
