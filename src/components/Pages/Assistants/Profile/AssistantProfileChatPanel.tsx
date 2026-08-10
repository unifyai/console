import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Send, Loader2, Paperclip, Mic, Square, Camera, File, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import { Textarea } from '@/components/UI/textarea';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useAssistantProfileChat } from '@/hooks/Assistants/useAssistantProfileChat';
import { clientLog } from '@/lib/logging/client-log-buffer';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import {
  ChatMessage,
  Attachment,
  CallPill,
  RequestSentAck,
  TimelineItem,
  isCallPill,
  isRequestSentAck,
} from '@/types/assistants/chat';
import {
  PendingAttachmentList,
  createAttachment,
  ChatMessageBubble,
  ChatDateDivider,
  isSameDay,
  CallPillBubble,
  RequestSentAckBubble,
  CallTranscriptDialog,
  ChatSearchDialog,
  OlderMessagesBanner,
} from '@/components/Chat';
import { useCallPills } from '@/hooks/Assistants/useCallPills';
import { useChatSearch } from '@/hooks/Assistants/useChatSearch';
import { useHistoricalView } from '@/hooks/Assistants/useHistoricalView';
import {
  validateFileType,
  isOversized,
  MAX_FILE_SIZE_BYTES,
} from '@/components/Chat/attachmentUtils';
import { USE_MOCK_EMBEDS, getMockEmbedMessages } from '@/utils/assistants/chat-embed-mock-data';
import { CameraCapture } from '@/components/Chat/CameraCapture';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { SpendingGateStatus, DEFAULT_SPENDING_GATE_STATUS } from '@/types/assistants/spendingGate';
import { useVoiceRecorder } from '@/hooks/Assistants/useVoiceRecorder';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useChatTTS } from '@/hooks/Assistants/useChatTTS';
import { ChatMessageSkeletons } from '@/components/Chat/ChatMessageSkeleton';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { isImeComposing } from '@/utils/keyboard';

/* --------------------------
   AssistantProfileChatPanel 
----------------------------- */
interface AssistantProfileChatPanelProps {
  assistant: Assistant;
  assistantActions: Pick<AssistantActions, 'chat'> & Partial<Pick<AssistantActions, 'voice'>>;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  requestAckHistories?: Record<string, RequestSentAck[]>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  /** Spending gate status for blocking new messages */
  spendingGate?: SpendingGateStatus;
  /** Page-level chat SSE connection health (rendered in the panel header). */
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  /** Force a reconnect of the page-level chat SSE. */
  reconnectChatStream: () => void;
  /** Monotonic inbound-frame counter for this assistant; clears typing. */
  chatStreamActivitySignal: number;
  /** Whether this assistant's call is currently connected */
  isCallConnected?: boolean;
  /** Externally controlled search dialog open state */
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  /**
   * Optional draft seed pushed in from outside the chat (currently
   * the setup-roadmap "Say hi" step). The composer's input value is
   * replaced with `text` and the textarea focused whenever `nonce`
   * changes — using a nonce-keyed object rather than the raw string
   * means the same suggestion can be re-applied without sticking the
   * input value in a one-way external prop.
   */
  draftSeed?: { text: string; nonce: number } | null;
  onAssistantAvatarStartCall?: () => void;
  isAssistantAvatarStartCallDisabled?: boolean;
  assistantAvatarStartCallTooltip?: string;
  /**
   * Force the assistant-replying typing bubble to render even when
   * no real reply is in flight. Used by the Coordinator onboarding
   * shell to keep a "typing…" hint visible while it waits for the
   * seeded greeting to land — the chat panel itself mounts
   * immediately so the input bar is present from the start, and
   * this prop drives a transient hint above an otherwise-empty
   * thread.
   */
  forceTypingIndicator?: boolean;
}

export function AssistantProfileChatPanel({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  requestAckHistories,
  userEmail,
  userTimezone,
  isFirstView,
  preHireChat,
  onFirstViewCompleted,
  spendingGate = DEFAULT_SPENDING_GATE_STATUS,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  isCallConnected = false,
  searchOpen: externalSearchOpen,
  onSearchOpenChange,
  draftSeed,
  onAssistantAvatarStartCall,
  isAssistantAvatarStartCallDisabled,
  assistantAvatarStartCallTooltip,
  forceTypingIndicator = false,
}: AssistantProfileChatPanelProps) {
  const displayName = assistantDisplayName(assistant);
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto || undefined;

  const { playMessage, stopPlayback, getAudioState, hasVoice, audioElement } = useChatTTS({
    voiceId: assistant.voiceId,
    voiceProvider: assistant.voiceProvider,
    generateSpeechAction: assistantActions.voice?.generate,
  });

  // Spending gate blocks new messages when limit is reached
  const isSpendingBlocked = spendingGate.isBlocked;

  const {
    messages,
    inputValue,
    isLoading,
    hasLoadedInitialHistory,
    initialLoadError,
    retryInitialLoad,
    isAssistantReplying,
    handleInputChange,
    setInputValue,
    sendMessage,
    cancelSend,
    connectionStatus,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
    loadMoreError,
    hasFetchedHistory,
    canChat,
    isRetryingContactId,
    reconnectSSE,
    currentContactId,
    toggleReaction,
  } = useAssistantProfileChat(
    assistant,
    assistantActions,
    chatHistories,
    setChatHistories,
    userEmail,
    {
      connectionStatus: chatStreamConnectionStatus,
      reconnect: reconnectChatStream,
      activitySignal: chatStreamActivitySignal,
    },
    isFirstView,
    preHireChat,
    onFirstViewCompleted
  );

  // Seed-from-outside draft (e.g. setup-roadmap "Say hi"). Keyed on
  // the seed's `nonce` so re-applying the same text works — and so
  // we don't fight the user if they're mid-typing and the same seed
  // happens to re-render with no actual change.
  const lastAppliedSeedNonceRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!draftSeed) return;
    if (lastAppliedSeedNonceRef.current === draftSeed.nonce) return;
    lastAppliedSeedNonceRef.current = draftSeed.nonce;
    setInputValue(draftSeed.text);
    // Defer focus to next frame so the textarea has the new value
    // committed before we move the caret.
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      const end = draftSeed.text.length;
      try {
        node.setSelectionRange(end, end);
      } catch {
        /* some browsers reject selection on disabled inputs — ignore */
      }
    });
  }, [draftSeed, setInputValue]);

  const {
    callPills,
    transcriptDialogOpen,
    activeTranscript,
    activeTranscriptLoading,
    activeTranscriptPill,
    openTranscript,
    closeTranscript,
  } = useCallPills({
    assistant,
    contactId: currentContactId,
    isCallConnected,
    callPillHistories,
    setCallPillHistories,
  });

  // Chat search
  const searchState = useChatSearch({
    assistant,
    ownerId: assistant.userId,
    assistantId: assistant.agentId,
    contactId: currentContactId,
  });

  // Historical view (jump-to-message)
  const {
    historicalView,
    isHistoricalMode,
    navigateToMessage,
    jumpToPresent,
    loadOlderHistorical,
    loadNewerHistorical,
  } = useHistoricalView({
    assistant,
    ownerId: assistant.userId,
    assistantId: assistant.agentId,
    contactId: currentContactId,
  });

  const [internalSearchOpen, setInternalSearchOpen] = React.useState(false);
  const searchDialogOpen = externalSearchOpen ?? internalSearchOpen;
  const setSearchDialogOpen = React.useCallback(
    (open: boolean) => {
      setInternalSearchOpen(open);
      onSearchOpenChange?.(open);
    },
    [onSearchOpenChange]
  );

  const { openBrainTranscript } = useAppShellNavigation();

  // Jump from a call pill to the same exchange in the Transcripts pane. Left
  // undefined when the pill has no resolved exchange -- an unrecorded call
  // outside the pane's loaded window, say -- so the dialog hides the control
  // instead of offering a dead end. `profile` carries the assistant through,
  // which matters when the pill was opened from the floating chat on another
  // surface.
  const openInTranscriptsTarget =
    activeTranscriptPill?.exchangeId != null && activeTranscriptPill.rootKey
      ? { exchangeId: activeTranscriptPill.exchangeId, rootKey: activeTranscriptPill.rootKey }
      : null;
  const handleOpenCallInTranscripts = React.useMemo(() => {
    if (!openInTranscriptsTarget) return undefined;
    return () => {
      closeTranscript();
      openBrainTranscript(openInTranscriptsTarget, { profile: assistant?.agentId ?? null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    openInTranscriptsTarget?.exchangeId,
    openInTranscriptsTarget?.rootKey,
    assistant?.agentId,
    closeTranscript,
    openBrainTranscript,
  ]);

  const handleGoToMessage = React.useCallback(
    (result: import('@/types/assistants/chat').ChatSearchResult) => {
      if (result.medium === 'unify_meet' && result.callId) {
        requestAnimationFrame(() => {
          const el = scrollAreaRef.current?.querySelector<HTMLElement>(
            `[data-call-id="${CSS.escape(result.callId!)}"]`
          );
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.classList.add('bg-muted');
            setTimeout(() => el.classList.remove('bg-muted'), 2000);
          }
        });
        return;
      }
      navigateToMessage(result);
    },
    [navigateToMessage]
  );

  const handleJumpToPresent = React.useCallback(() => {
    jumpToPresent();
    // Scroll to bottom after React renders present messages
    requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
        '[data-radix-scroll-area-viewport]'
      );
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
  }, [jumpToPresent]);

  const sseBlocked = connectionStatus === 'error';

  // Memoise the live and historical timelines so we don't pay an O(n log n)
  // sort + array allocation on every parent re-render. The chat panel
  // re-renders on every keystroke in the composer (because `inputValue`
  // lives in `useAssistantProfileChat`), and re-sorting hundreds of
  // messages per keystroke is one of the dominant typing-lag contributors
  // in long conversations.
  const requestAcks = React.useMemo(
    () => requestAckHistories?.[assistant.agentId] ?? [],
    [requestAckHistories, assistant.agentId]
  );

  const liveTimeline = React.useMemo<TimelineItem[]>(() => {
    const baseMessages: ChatMessage[] = USE_MOCK_EMBEDS
      ? [...messages, ...getMockEmbedMessages()]
      : messages;
    return [...baseMessages, ...callPills, ...requestAcks].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [messages, callPills, requestAcks]);

  const historicalTimeline = React.useMemo<TimelineItem[]>(() => {
    if (!historicalView) return [];
    return [...historicalView.messages, ...historicalView.callPills].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [historicalView]);

  const awaitingAssistantReply = React.useMemo(
    () => messages.length === 0 || messages[messages.length - 1].role === 'user',
    [messages]
  );

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const isAtBottomRef = React.useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preserveScrollRef = React.useRef<number | null>(null);
  const prevSpendingBlockedRef = React.useRef<boolean>(isSpendingBlocked);

  // Voice recorder
  const handleVoiceTranscript = React.useCallback(
    (text: string) => {
      setInputValue((prev: string) => (prev ? `${prev} ${text}` : text));
    },
    [setInputValue]
  );
  // Voice-note dictation requires the transcription provider (Deepgram). Hide
  // the mic entirely on deployments without it rather than surface a button
  // that 500s.
  const { transcription: transcriptionEnabled } = useFeatures();
  const { recorderError, toggleRecording, stopRecording, isRecording, isTranscribing } =
    useVoiceRecorder({
      onTranscript: handleVoiceTranscript,
    });

  React.useEffect(() => {
    if (recorderError) toast.error(recorderError);
  }, [recorderError]);

  // Attachment state
  const [pendingAttachments, setPendingAttachments] = React.useState<Attachment[]>([]);

  // Camera capture state
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);

  /* Cleanup on unmount to release File object references */
  React.useEffect(() => {
    return () => {
      setPendingAttachments([]);
    };
  }, []);

  /* Force SSE reconnection when spending becomes unblocked.
   * This ensures the SSE connection is fresh after spending limit changes,
   * preventing stale connections that might not deliver messages. */
  React.useEffect(() => {
    if (prevSpendingBlockedRef.current && !isSpendingBlocked) {
      // Spending just became unblocked - reconnect SSE to ensure fresh connection
      reconnectSSE();
    }
    prevSpendingBlockedRef.current = isSpendingBlocked;
  }, [isSpendingBlocked, reconnectSSE]);

  /* File handling — type validation rejects immediately; oversized files are
     added with a visual warning and filtered out at send time. */
  const handleFiles = React.useCallback(
    (files: File[]) => {
      const newAttachments: Attachment[] = [];

      const oversizedNames: string[] = [];

      for (const file of files) {
        const typeCheck = validateFileType(file.name);
        if (!typeCheck.valid) {
          toast.error(typeCheck.error);
          continue;
        }
        if (pendingAttachments.some((a) => a.filename === file.name && a.sizeBytes === file.size)) {
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedNames.push(file.name);
        }
        newAttachments.push(createAttachment(file));
      }

      if (newAttachments.length > 0) {
        setPendingAttachments((prev) => [...prev, ...newAttachments]);
      }

      if (oversizedNames.length > 0) {
        const limitMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        for (const name of oversizedNames) {
          toast.error(`${name} exceeds ${limitMB} MB limit — will be dropped on send`);
        }
      }
    },
    [pendingAttachments]
  );

  const removeAttachment = React.useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.uploadStatus === 'uploading') return prev;
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleCameraCapture = React.useCallback(
    (file: File) => {
      handleFiles([file]);
    },
    [handleFiles]
  );

  /* react-dropzone setup */
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleFiles,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  /* Auto-resize textarea (ChatGPT-style: grows with content, scrollbar after max) */
  const TEXTAREA_MIN_HEIGHT = 48;
  const TEXTAREA_MAX_HEIGHT = 200;

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.minHeight = `${TEXTAREA_MIN_HEIGHT}px`;
    textarea.style.overflowY = 'hidden';
    textarea.style.scrollbarWidth = 'none';

    if (!inputValue) {
      textarea.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
      return;
    }

    textarea.style.height = 'auto';
    const scrollHeight = Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT);

    if (scrollHeight > TEXTAREA_MAX_HEIGHT) {
      textarea.style.height = `${TEXTAREA_MAX_HEIGHT}px`;
      textarea.style.overflowY = 'auto';
      textarea.style.scrollbarWidth = 'thin';
    } else {
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [inputValue]);

  const getChatViewport = React.useCallback(() => {
    return scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
  }, []);

  const scrollChatToBottom = React.useCallback(() => {
    const viewport = getChatViewport();
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
    isAtBottomRef.current = true;
    setShowScrollToBottom(false);
  }, [getChatViewport]);

  /* Infinite scroll trigger + track bottom stickiness on manual scroll */
  React.useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (!viewport) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const atBottom = scrollHeight - scrollTop - clientHeight <= 20;
      isAtBottomRef.current = atBottom;
      if (!isHistoricalMode) {
        setShowScrollToBottom(!atBottom);
      }

      if (isHistoricalMode) {
        if (scrollTop < 10 && historicalView?.hasOlder && !historicalView.isLoadingOlder) {
          preserveScrollRef.current = scrollHeight;
          loadOlderHistorical();
        }
        const atBottom = scrollHeight - scrollTop - clientHeight < 10;
        if (atBottom && historicalView?.hasNewer && !historicalView.isLoadingNewer) {
          loadNewerHistorical();
        }
        if (
          atBottom &&
          !historicalView?.hasNewer &&
          !historicalView?.isLoadingNewer &&
          !historicalView?.isLoadingOlder &&
          (historicalView?.messages.length ?? 0) > 0
        ) {
          handleJumpToPresent();
        }
        return;
      }

      if (
        scrollTop < 10 &&
        hasMoreMessages &&
        !isLoadingMore &&
        !isLoading &&
        !loadMoreError &&
        !initialLoadError
      ) {
        preserveScrollRef.current = scrollHeight;
        loadMoreMessages();
      }
    };
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [
    hasMoreMessages,
    isLoadingMore,
    isLoading,
    loadMoreMessages,
    loadMoreError,
    initialLoadError,
    isHistoricalMode,
    historicalView,
    loadOlderHistorical,
    loadNewerHistorical,
    handleJumpToPresent,
  ]);

  /* Scroll position preservation when loading older messages */
  React.useLayoutEffect(() => {
    if (preserveScrollRef.current !== null) {
      const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
        '[data-radix-scroll-area-viewport]'
      );
      if (viewport) {
        const newHeight = viewport.scrollHeight;
        const diff = newHeight - preserveScrollRef.current;
        if (diff > 0) {
          viewport.scrollTop = diff;
        }
        preserveScrollRef.current = null;
      }
    }
  }, [messages]);

  /* Auto-scroll behavior (bottom stickiness) */
  React.useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (!viewport) return;

    const prevScrollHeight = prevScrollHeightRef.current;
    const { scrollTop, scrollHeight, clientHeight } = viewport;

    // Decide whether the user was pinned to the bottom BEFORE the content
    // changed, using the *previous* scrollHeight. Using the current
    // scrollHeight here is wrong: when a new reply is appended, scrollHeight
    // grows while scrollTop stays put, so `scrollHeight - scrollTop - clientHeight`
    // immediately looks "not at bottom" and auto-scroll never fires. The
    // `!isLoadingMore` guard below handles the "load older" case where the
    // useLayoutEffect has already preserved scroll position — we never
    // auto-scroll during a prepend.
    const wasBottom =
      prevScrollHeight === null || prevScrollHeight - scrollTop - clientHeight <= 20;
    isAtBottomRef.current = wasBottom;

    if (scrollHeight !== prevScrollHeight && wasBottom && !isLoadingMore) {
      viewport.scrollTop = scrollHeight;
      setShowScrollToBottom(false);
    } else if (scrollHeight !== prevScrollHeight && !wasBottom) {
      clientLog('SCROLL_NOT_STICKY', {
        wasBottom,
        isLoadingMore,
        scrollHeightDelta: scrollHeight - (prevScrollHeight ?? 0),
        msgCount: messages.length,
      });
    }

    prevScrollHeightRef.current = scrollHeight;
  }, [messages, isAssistantReplying, isLoadingMore]);

  /* Pin to the latest messages once the initial transcript snapshot lands. */
  const prevHasLoadedInitialHistoryRef = React.useRef(false);
  React.useEffect(() => {
    const justLoaded = hasLoadedInitialHistory && !prevHasLoadedInitialHistoryRef.current;
    prevHasLoadedInitialHistoryRef.current = hasLoadedInitialHistory;
    if (!justLoaded || isHistoricalMode || messages.length === 0) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollChatToBottom();
        const viewport = getChatViewport();
        if (viewport) {
          prevScrollHeightRef.current = viewport.scrollHeight;
        }
      });
    });
  }, [
    getChatViewport,
    hasLoadedInitialHistory,
    isHistoricalMode,
    messages.length,
    scrollChatToBottom,
  ]);

  /* Scroll to anchor message when historical view loads */
  const prevAnchorRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!historicalView) {
      prevAnchorRef.current = null;
      return;
    }
    if (historicalView.messages.length === 0) return;
    if (prevAnchorRef.current === historicalView.anchorMessageKey) return;
    prevAnchorRef.current = historicalView.anchorMessageKey;

    requestAnimationFrame(() => {
      const el = scrollAreaRef.current?.querySelector(
        `[data-message-key="${CSS.escape(historicalView.anchorMessageKey)}"]`
      );
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('bg-muted');
        setTimeout(() => el.classList.remove('bg-muted'), 2000);
      }
    });
  }, [historicalView]);

  /* Maintain bottom stickiness on viewport resize (e.g. window resize causing
   * text reflow or container height change). */
  React.useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (!viewport) return;

    const ro = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
    ro.observe(viewport);
    return () => ro.disconnect();
  }, []);

  const isUploading = pendingAttachments.some(
    (a) =>
      a.uploadStatus === 'queued' || a.uploadStatus === 'uploading' || a.uploadStatus === 'done'
  );

  /* Handle send with attachments */
  const handleSendWithAttachments = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isLoading || isUploading) return;
      if (!inputValue.trim() && pendingAttachments.length === 0) return;

      const uploadable = pendingAttachments.filter((a) => !isOversized(a.sizeBytes));
      const oversizedCount = pendingAttachments.length - uploadable.length;

      if (!inputValue.trim() && uploadable.length === 0) return;

      // Drop oversized files from the pending list
      if (oversizedCount > 0) {
        setPendingAttachments(uploadable);
        toast.error(`${oversizedCount} file${oversizedCount > 1 ? 's' : ''} dropped (too large)`);
      }

      // Mark uploadable chips as pending upload
      setPendingAttachments((prev) =>
        prev.map((a) => ({ ...a, uploadStatus: 'pending' as const }))
      );

      // Force scroll-to-bottom on send so the user always sees their new
      // message land, even if they had scrolled up to read older context.
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
          '[data-radix-scroll-area-viewport]'
        );
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      });

      sendMessage(e, uploadable, setPendingAttachments);
    },
    [inputValue, pendingAttachments, sendMessage, isLoading, isUploading]
  );

  const handleCancelSend = React.useCallback(() => {
    cancelSend();
    setPendingAttachments((prev) => prev.map((a) => ({ ...a, uploadStatus: undefined })));
  }, [cancelSend]);

  const sendMessageOnEnter = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isImeComposing(event)) return;
      if (isRecording) {
        event.preventDefault();
        stopRecording();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendWithAttachments({ preventDefault: () => {} } as React.FormEvent);
      }
    },
    [isRecording, stopRecording, handleSendWithAttachments]
  );

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      {/* Chat Area */}
      <ScrollArea
        // Radix wraps viewport children in a `display:table` div, which
        // sizes to intrinsic content width — long URLs / code in a
        // message bubble end up pushing the wrapper wider than the
        // viewport and the bubble overflows horizontally on mobile.
        // Forcing the wrapper to `display:block` lets `min-w-0` +
        // `break-words` on bubbles do their job and stay within the
        // viewport bounds. Scoped to this scroll area so we don't
        // disturb any callsite that genuinely wants horizontal scroll.
        className="scroll-fade-y [&>[data-radix-scroll-area-viewport]]:scroll-fade-y flex-1 px-3 pb-4 md:px-6 [&>[data-radix-scroll-area-viewport]>div]:!block"
        ref={scrollAreaRef}
        data-testid="chat-scroll-area"
      >
        {initialLoadError ? (
          <div className="animate-fade-in flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="space-y-1 text-center">
              <p className="text-title">Failed to load chat history</p>
              <p className="text-caption opacity-80">Please check your connection</p>
            </div>
            <Button variant="outline" size="sm" onClick={retryInitialLoad} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Retry
            </Button>
          </div>
        ) : isLoading && !hasLoadedInitialHistory ? (
          <ChatMessageSkeletons />
        ) : (
          <div className="space-y-6 py-4" style={{ width: '100%' }}>
            {isHistoricalMode ? (
              <>
                {historicalView?.isLoadingOlder && <ChatMessageSkeletons />}
                {!historicalView?.hasOlder &&
                  !historicalView?.isLoadingOlder &&
                  historicalView &&
                  historicalView.messages.length > 0 && (
                    <div className="text-caption animate-fade-in w-full py-1 text-center text-muted-foreground">
                      No more messages
                    </div>
                  )}
                {historicalView?.messages.length === 0 && historicalView?.isLoadingOlder && (
                  <ChatMessageSkeletons />
                )}
                {historicalView &&
                  historicalTimeline.map((item, i, arr) => {
                    const prevItem = arr[i - 1];
                    const showDivider =
                      !prevItem || !isSameDay(prevItem.timestamp, item.timestamp, userTimezone);

                    if (isCallPill(item)) {
                      return (
                        <React.Fragment key={item.id}>
                          {showDivider && (
                            <ChatDateDivider date={item.timestamp} timezone={userTimezone} />
                          )}
                          <CallPillBubble
                            pill={item}
                            timezone={userTimezone}
                            onClick={openTranscript}
                          />
                        </React.Fragment>
                      );
                    }

                    if (isRequestSentAck(item)) {
                      return (
                        <React.Fragment key={item.id}>
                          {showDivider && (
                            <ChatDateDivider date={item.timestamp} timezone={userTimezone} />
                          )}
                          <RequestSentAckBubble ack={item} timezone={userTimezone} />
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={item.id}>
                        {showDivider && (
                          <ChatDateDivider date={item.timestamp} timezone={userTimezone} />
                        )}
                        <div
                          data-message-key={`${item.sourceContext ?? ''}:${item.messageId ?? item.id}`}
                          data-message-id={item.messageId}
                          className="transition-colors duration-1000"
                        >
                          <ChatMessageBubble
                            message={item.content}
                            isUser={item.role === 'user'}
                            assistantPhoto={photoSrc}
                            assistantName={displayName}
                            isCoordinator={assistant.isCoordinator}
                            timestamp={item.timestamp}
                            timezone={userTimezone}
                            index={i}
                            attachments={item.attachments}
                            onAssistantAvatarStartCall={onAssistantAvatarStartCall}
                            isAssistantAvatarStartCallDisabled={isAssistantAvatarStartCallDisabled}
                            assistantAvatarStartCallTooltip={assistantAvatarStartCallTooltip}
                            transcriptMessageId={item.messageId}
                            reactions={item.reactions}
                            currentContactId={currentContactId}
                            canReact={canChat && !isSpendingBlocked && currentContactId !== null}
                            onToggleReaction={
                              canChat && !isSpendingBlocked && currentContactId !== null
                                ? (emoji) => {
                                    if (item.messageId !== undefined) {
                                      void toggleReaction(item.messageId!, emoji);
                                    }
                                  }
                                : undefined
                            }
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                {historicalView?.isLoadingNewer && <ChatMessageSkeletons />}
              </>
            ) : (
              <>
                {hasFetchedHistory && !hasMoreMessages && (
                  <div className="text-caption animate-fade-in w-full py-1 text-center text-muted-foreground">
                    No more messages
                  </div>
                )}
                {isLoadingMore && (
                  <div className="text-caption flex w-full flex-row justify-center gap-2 py-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading messages
                  </div>
                )}
                {loadMoreError && (
                  <div className="animate-fade-in flex w-full flex-col items-center gap-2 py-1">
                    <Button
                      role="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
                          '[data-radix-scroll-area-viewport]'
                        );
                        if (viewport) preserveScrollRef.current = viewport.scrollHeight;
                        loadMoreMessages();
                      }}
                      className="text-caption h-3"
                    >
                      Failed to load more. Retry
                    </Button>
                  </div>
                )}
                {liveTimeline.map((item, i, arr) => {
                  const prevItem = arr[i - 1];
                  const showDivider =
                    !prevItem || !isSameDay(prevItem.timestamp, item.timestamp, userTimezone);

                  if (isCallPill(item)) {
                    return (
                      <React.Fragment key={item.id}>
                        {showDivider && (
                          <ChatDateDivider date={item.timestamp} timezone={userTimezone} />
                        )}
                        <CallPillBubble
                          pill={item}
                          timezone={userTimezone}
                          onClick={openTranscript}
                        />
                      </React.Fragment>
                    );
                  }

                  if (isRequestSentAck(item)) {
                    return (
                      <React.Fragment key={item.id}>
                        {showDivider && (
                          <ChatDateDivider date={item.timestamp} timezone={userTimezone} />
                        )}
                        <RequestSentAckBubble ack={item} timezone={userTimezone} />
                      </React.Fragment>
                    );
                  }

                  const msg = item;
                  // Pass `playMessage` directly (not a per-render `() => …`
                  // closure) so `React.memo` on `ChatMessageBubble` actually
                  // bails out on keystrokes — the bubble builds its own
                  // onClick handler from `messageId` + `message`.
                  const audioEnabled = hasVoice && msg.role === 'assistant' && !!msg.content;
                  const audioState = audioEnabled ? getAudioState(msg.id) : undefined;
                  return (
                    <React.Fragment key={msg.id}>
                      {showDivider && (
                        <ChatDateDivider date={msg.timestamp} timezone={userTimezone} />
                      )}
                      <ChatMessageBubble
                        message={msg.content}
                        isUser={msg.role === 'user'}
                        assistantPhoto={photoSrc}
                        assistantName={displayName}
                        isCoordinator={assistant.isCoordinator}
                        timestamp={msg.timestamp}
                        timezone={userTimezone}
                        index={i}
                        attachments={msg.attachments}
                        messageId={msg.id}
                        onPlayAudio={audioEnabled ? playMessage : undefined}
                        onStopAudio={audioEnabled ? stopPlayback : undefined}
                        audioState={audioState}
                        audioElement={audioState === 'playing' ? audioElement : null}
                        onAssistantAvatarStartCall={onAssistantAvatarStartCall}
                        isAssistantAvatarStartCallDisabled={isAssistantAvatarStartCallDisabled}
                        assistantAvatarStartCallTooltip={assistantAvatarStartCallTooltip}
                        transcriptMessageId={msg.messageId}
                        reactions={msg.reactions}
                        currentContactId={currentContactId}
                        canReact={canChat && !isSpendingBlocked && currentContactId !== null}
                        onToggleReaction={
                          canChat && !isSpendingBlocked && currentContactId !== null
                            ? (emoji) => {
                                if (msg.messageId !== undefined) {
                                  void toggleReaction(msg.messageId!, emoji);
                                }
                              }
                            : undefined
                        }
                      />
                    </React.Fragment>
                  );
                })}
                {(forceTypingIndicator || (isAssistantReplying && awaitingAssistantReply)) && (
                  <ChatMessageBubble
                    message=""
                    isUser={false}
                    assistantPhoto={photoSrc}
                    assistantName={displayName}
                    isCoordinator={assistant.isCoordinator}
                    isLoading={true}
                    index={messages.length}
                    onAssistantAvatarStartCall={onAssistantAvatarStartCall}
                    isAssistantAvatarStartCallDisabled={isAssistantAvatarStartCallDisabled}
                    assistantAvatarStartCallTooltip={assistantAvatarStartCallTooltip}
                  />
                )}
              </>
            )}
          </div>
        )}
      </ScrollArea>

      {!isHistoricalMode && showScrollToBottom && (
        <div className="pointer-events-none relative z-10 -mt-12 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-8 w-8 rounded-full shadow-md"
            onClick={scrollChatToBottom}
            aria-label="Scroll to bottom"
            data-testid="chat-scroll-to-bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Historical view banner */}
      {isHistoricalMode && <OlderMessagesBanner onJumpToPresent={handleJumpToPresent} />}

      {/* Input Area */}
      <form onSubmit={handleSendWithAttachments} className="bg-background px-4 pb-4 pt-2">
        {/* Pending attachments — outside dropzone so tooltips work */}
        {pendingAttachments.length > 0 && (
          <PendingAttachmentList
            attachments={pendingAttachments}
            onRemove={removeAttachment}
            onRemoveAll={() => setPendingAttachments([])}
            onCancel={handleCancelSend}
            className="mb-2"
          />
        )}

        <div
          {...getRootProps()}
          className={cn('relative', isDragActive && 'rounded-md ring-2 ring-primary ring-offset-2')}
          data-testid="chat-dropzone"
        >
          {/* Drag-and-drop overlay */}
          {isDragActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary-tint-10">
              <span className="font-medium text-primary">Drop files here</span>
            </div>
          )}

          {/* Hidden file input — getInputProps() owns the ref and hides the
             element via clip/position:absolute. Do NOT override the ref or add
             display:none; doing so breaks multi-file selection in some browsers. */}
          <input {...getInputProps()} data-testid="file-input" />

          <div className="relative">
            {/* Attach dropdown (files + webcam) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 left-2 h-8 w-8 rounded-full"
                  disabled={
                    !canChat ||
                    isLoading ||
                    isUploading ||
                    initialLoadError ||
                    sseBlocked ||
                    isSpendingBlocked ||
                    isRecording
                  }
                  aria-label="Attach"
                  data-testid="attach-button"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem
                  onClick={() => setIsCameraOpen(true)}
                  data-testid="attach-webcam-item"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={open} data-testid="attach-files-item">
                  <File className="h-4 w-4" />
                  Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Voice recorder button */}
            {transcriptionEnabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute bottom-2 left-10 h-8 w-8 rounded-full',
                  isRecording && 'animate-pulse text-[color:var(--status-danger)]'
                )}
                onClick={toggleRecording}
                disabled={
                  !canChat ||
                  isLoading ||
                  isUploading ||
                  initialLoadError ||
                  sseBlocked ||
                  isSpendingBlocked ||
                  isTranscribing
                }
                aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
                data-testid="voice-record-button"
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}

            <Textarea
              ref={textareaRef}
              rows={1}
              placeholder={
                isRecording
                  ? 'Recording...'
                  : isTranscribing
                    ? 'Transcribing...'
                    : !canChat
                      ? isRetryingContactId
                        ? 'Chat unavailable, retrying connection...'
                        : 'Chat unavailable'
                      : isSpendingBlocked
                        ? spendingGate.blockedMessage || 'Spending limit reached'
                        : initialLoadError
                          ? 'Connection failed'
                          : connectionStatus === 'error'
                            ? 'Connection failed. Please refresh.'
                            : 'Send a message...'
              }
              value={inputValue}
              onChange={handleInputChange}
              disabled={
                !canChat || isUploading || initialLoadError || sseBlocked || isSpendingBlocked
              }
              className="styled-scrollbar text-body h-12 min-h-12 resize-none overflow-y-hidden rounded-xl py-3.5 pl-14 pr-12 leading-5 sm:pl-20 sm:pr-14"
              autoComplete="off"
              onKeyDown={sendMessageOnEnter}
            />

            {/* Send / Cancel button - bottom right */}
            {isUploading ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      aria-label="Cancel send"
                      size="icon"
                      variant="outline"
                      className="group/cancel absolute bottom-2 right-2 h-8 w-8 rounded-full hover:bg-muted"
                      onClick={handleCancelSend}
                    >
                      <Loader2 className="h-4 w-4 animate-spin group-hover/cancel:hidden" />
                      <X className="hidden h-4 w-4 group-hover/cancel:block" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-caption font-medium">Cancel send</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                type="submit"
                aria-label="Send message"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
                disabled={
                  !canChat ||
                  isLoading ||
                  (!inputValue.trim() && pendingAttachments.length === 0) ||
                  initialLoadError ||
                  sseBlocked ||
                  isSpendingBlocked
                }
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </form>

      <CameraCapture
        open={isCameraOpen}
        onOpenChange={setIsCameraOpen}
        onCapture={handleCameraCapture}
      />

      <CallTranscriptDialog
        open={transcriptDialogOpen}
        onOpenChange={closeTranscript}
        onOpenInTranscripts={handleOpenCallInTranscripts}
        pill={activeTranscriptPill}
        utterances={activeTranscript}
        loading={activeTranscriptLoading}
        assistantName={displayName}
      />

      <ChatSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        searchState={searchState}
        assistantName={displayName}
        onGoToMessage={handleGoToMessage}
      />
    </div>
  );
}
