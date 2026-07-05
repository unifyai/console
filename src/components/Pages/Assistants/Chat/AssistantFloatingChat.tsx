'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Maximize2, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import { useFloatingShellGeometry } from '@/components/Common/FloatingShell/useFloatingShellGeometry';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ChatMessage, CallPill, RequestSentAck } from '@/types/assistants/chat';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import {
  readFloatingChatCollapsedPreference,
  writeFloatingChatCollapsedPreference,
} from '@/hooks/Assistants/useFloatingChatVisibility';

/** Sits above the shared h-10 tab footer (`bottom-14` = 3.5rem). */
const LAUNCHER_BOTTOM_CLASS = 'bottom-14';
const LAUNCHER_SIZE_CLASS = 'h-16 w-16';
const HEADER_AVATAR_SIZE_CLASS = 'h-7 w-7';

function FloatingChatAssistantAvatar({
  assistant,
  displayName,
  sizeClass,
}: {
  assistant: Assistant;
  displayName: string;
  sizeClass: string;
}) {
  if (assistant.isCoordinator) {
    return <CoordinatorLogoAvatar className={cn('shrink-0', sizeClass)} />;
  }

  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const creatureAppearance = parseCreatureSentinel(photoSrc);
  if (creatureAppearance) {
    return (
      <CreatureAvatar
        appearance={creatureAppearance}
        className={cn('shrink-0', sizeClass)}
        label={displayName}
      />
    );
  }

  if (photoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed teammate photo URL
      <img
        src={photoSrc}
        alt={displayName}
        className={cn('shrink-0 object-contain object-bottom', sizeClass)}
      />
    );
  }

  return (
    <span className="text-title shrink-0 font-display" aria-hidden>
      {assistantInitials(assistant)}
    </span>
  );
}

function FloatingChatHeaderIconButton({
  label,
  testId,
  onClick,
  className,
  children,
}: {
  label: string;
  testId?: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground', className)}
      aria-label={label}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </Button>
  );
}

export interface AssistantFloatingChatProps {
  assistant: Assistant;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  requestAckHistories?: Record<string, RequestSentAck[]>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  spendingGate: SpendingGateStatus;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;
  unreadCount: number;
  visible: boolean;
  hasActiveCall: boolean;
  isInActiveCall: boolean;
  isCallConnected: boolean;
  onReturnToCall?: () => void;
  onDismiss?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export function AssistantFloatingChat({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  requestAckHistories,
  userEmail,
  userTimezone,
  spendingGate,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  unreadCount,
  visible,
  hasActiveCall,
  isInActiveCall,
  isCallConnected,
  onReturnToCall,
  onDismiss,
  onExpandedChange,
}: AssistantFloatingChatProps) {
  const { navigateToAssistantChat } = useAppShellNavigation();
  const [collapsed, setCollapsed] = React.useState(readFloatingChatCollapsedPreference);
  const [mounted, setMounted] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const {
    floatingPos,
    floatingSize,
    seedDefaultGeometry,
    handleHeaderPointerDown,
    handleCornerResize,
    handleEdgeResize,
    handleResizeEnd,
  } = useFloatingShellGeometry({ preset: 'chat', seedOnMount: false });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (visible && !collapsed) {
      seedDefaultGeometry();
    }
  }, [visible, collapsed, seedDefaultGeometry]);

  const displayName = assistantDisplayName(assistant);

  const setCollapsedPreference = React.useCallback((next: boolean) => {
    setCollapsed(next);
    writeFloatingChatCollapsedPreference(next);
  }, []);

  React.useEffect(() => {
    onExpandedChange?.(!collapsed);
  }, [collapsed, onExpandedChange]);

  const handleBackToChat = React.useCallback(() => {
    if (hasActiveCall && onReturnToCall) {
      onReturnToCall();
      return;
    }
    navigateToAssistantChat(assistant.agentId);
  }, [assistant.agentId, hasActiveCall, navigateToAssistantChat, onReturnToCall]);

  const handleDismiss = React.useCallback(() => {
    setCollapsedPreference(true);
    onDismiss?.();
  }, [onDismiss, setCollapsedPreference]);

  const onHeaderPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      handleHeaderPointerDown(e, contentRef);
    },
    [handleHeaderPointerDown]
  );

  if (!mounted) return null;

  const resizeHandleClass = 'absolute z-10 h-3 w-3 opacity-0 hover:opacity-100 transition-opacity';

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key="floating-chat-root"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed inset-0 z-[45]"
        >
          {collapsed ? (
            <div
              className={cn(
                'group pointer-events-auto fixed right-5 flex flex-col items-end gap-1',
                LAUNCHER_BOTTOM_CLASS
              )}
            >
              {onDismiss && (
                <FloatingChatHeaderIconButton
                  label="Hide chat"
                  testId="floating-chat-dismiss"
                  onClick={handleDismiss}
                  className="bg-background/95 h-6 w-6 opacity-0 shadow-sm ring-1 ring-border transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </FloatingChatHeaderIconButton>
              )}
              <div className={cn('relative', LAUNCHER_SIZE_CLASS)}>
                <motion.button
                  type="button"
                  data-testid="floating-chat-launcher"
                  aria-label={`Open chat with ${displayName}`}
                  className={cn(
                    'flex h-full w-full shrink-0 items-end justify-center bg-transparent p-0',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  )}
                  onClick={() => setCollapsedPreference(false)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <FloatingChatAssistantAvatar
                    assistant={assistant}
                    displayName={displayName}
                    sizeClass={LAUNCHER_SIZE_CLASS}
                  />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -right-0.5 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background"
                      data-testid="floating-chat-unread-badge"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </motion.button>
              </div>
            </div>
          ) : (
            <div
              ref={contentRef}
              data-testid="floating-chat-panel"
              className="bg-background/95 pointer-events-auto fixed flex flex-col overflow-hidden rounded-lg border border-border text-foreground shadow-2xl backdrop-blur-md"
              style={{
                left: floatingPos.x,
                top: floatingPos.y,
                width: floatingSize.width,
                height: floatingSize.height,
              }}
            >
              <div
                className="bg-muted/40 group/header flex shrink-0 cursor-grab flex-col border-b border-border active:cursor-grabbing"
                onPointerDown={onHeaderPointerDown}
              >
                {hasActiveCall && (
                  <div
                    className="flex items-center justify-between gap-2 border-b border-border bg-primary-tint-10 px-3 py-1.5"
                    data-testid="floating-chat-in-call-strip"
                  >
                    <div className="text-caption flex items-center gap-1.5 text-primary">
                      <Phone className="h-3.5 w-3.5" />
                      {isCallConnected ? 'Live call' : 'Connecting call…'}
                    </div>
                    {onReturnToCall && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        data-testid="floating-chat-return-to-call"
                        onClick={onReturnToCall}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        Return to call
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2">
                  <FloatingChatAssistantAvatar
                    assistant={assistant}
                    displayName={displayName}
                    sizeClass={HEADER_AVATAR_SIZE_CLASS}
                  />
                  <span className="text-title min-w-0 flex-1 truncate font-display">
                    {displayName}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      data-testid="floating-chat-back-to-full"
                      onClick={handleBackToChat}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Maximize2 className="mr-1 h-3.5 w-3.5" />
                      Back to chat
                    </Button>
                    <div className="group-hover/header:bg-background/60 flex items-center rounded-md border border-transparent pl-0.5 transition-colors group-hover/header:border-border">
                      <FloatingChatHeaderIconButton
                        label="Minimize chat"
                        testId="floating-chat-minimize"
                        onClick={() => setCollapsedPreference(true)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </FloatingChatHeaderIconButton>
                      {onDismiss && (
                        <FloatingChatHeaderIconButton
                          label="Hide chat"
                          testId="floating-chat-dismiss"
                          onClick={handleDismiss}
                          className="opacity-0 transition-opacity group-hover/header:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </FloatingChatHeaderIconButton>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <AssistantProfileChatPanel
                  assistant={assistant}
                  assistantActions={assistantActions}
                  chatHistories={chatHistories}
                  setChatHistories={setChatHistories}
                  callPillHistories={callPillHistories}
                  setCallPillHistories={setCallPillHistories}
                  requestAckHistories={requestAckHistories}
                  userEmail={userEmail}
                  userTimezone={userTimezone}
                  spendingGate={spendingGate}
                  chatStreamConnectionStatus={chatStreamConnectionStatus}
                  reconnectChatStream={reconnectChatStream}
                  chatStreamActivitySignal={chatStreamActivitySignal}
                  isCallConnected={isInActiveCall && isCallConnected}
                />
              </div>

              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <motion.div
                  key={corner}
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                  onDrag={handleCornerResize(corner)}
                  onDragEnd={handleResizeEnd}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    resizeHandleClass,
                    corner === 'tl' && 'left-0 top-0 cursor-nwse-resize',
                    corner === 'tr' && 'right-0 top-0 cursor-nesw-resize',
                    corner === 'bl' && 'bottom-0 left-0 cursor-nesw-resize',
                    corner === 'br' && 'bottom-0 right-0 cursor-nwse-resize'
                  )}
                />
              ))}
              {(['t', 'r', 'b', 'l'] as const).map((edge) => (
                <motion.div
                  key={edge}
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                  onDrag={handleEdgeResize(edge)}
                  onDragEnd={handleResizeEnd}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    'absolute z-10 opacity-0 transition-opacity hover:opacity-100',
                    edge === 't' && 'left-3 right-3 top-0 h-1.5 cursor-ns-resize',
                    edge === 'b' && 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize',
                    edge === 'l' && 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize',
                    edge === 'r' && 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize'
                  )}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
