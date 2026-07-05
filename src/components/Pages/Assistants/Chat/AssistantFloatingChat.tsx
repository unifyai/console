'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Maximize2, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import { useFloatingShellGeometry } from '@/components/Common/FloatingShell/useFloatingShellGeometry';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ChatMessage, CallPill, RequestSentAck } from '@/types/assistants/chat';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import {
  readFloatingChatCollapsedPreference,
  writeFloatingChatCollapsedPreference,
} from '@/hooks/Assistants/useFloatingChatVisibility';

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
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto || undefined;

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
            <motion.button
              type="button"
              data-testid="floating-chat-launcher"
              aria-label={`Open chat with ${displayName}`}
              className="pointer-events-auto fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-pop-lg"
              onClick={() => setCollapsedPreference(false)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={photoSrc} alt={displayName} />
                <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
              </Avatar>
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                  data-testid="floating-chat-unread-badge"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </motion.button>
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
                className="bg-muted/40 flex shrink-0 cursor-grab flex-col border-b border-border active:cursor-grabbing"
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
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={photoSrc} alt={displayName} />
                    <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="text-title min-w-0 flex-1 truncate font-display">
                    {displayName}
                  </span>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Minimize chat"
                    data-testid="floating-chat-minimize"
                    onClick={() => setCollapsedPreference(true)}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
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
