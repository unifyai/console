'use client';

import * as React from 'react';
import { AssistantFloatingChat } from '@/components/Pages/Assistants/Chat/AssistantFloatingChat';
import {
  useFloatingChatVisibility,
  type FloatingChatVisibilityInput,
} from '@/hooks/Assistants/useFloatingChatVisibility';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';

interface AssistantFloatingChatHostProps extends FloatingChatVisibilityInput {
  assistant: Assistant;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  spendingGate: SpendingGateStatus;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;
  unreadCount: number;
  hasActiveCall: boolean;
  isInActiveCall: boolean;
  isCallConnected: boolean;
  activeCallAssistantId: string | null;
  onExpandedChange: (expanded: boolean) => void;
  redock: () => void;
}

export function AssistantFloatingChatHost({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  userEmail,
  userTimezone,
  spendingGate,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  unreadCount,
  hasActiveCall,
  isInActiveCall,
  isCallConnected,
  activeCallAssistantId,
  onExpandedChange,
  redock,
  ...visibilityInput
}: AssistantFloatingChatHostProps) {
  const { navigateToAssistantChat } = useAppShellNavigation();
  const visible = useFloatingChatVisibility(visibilityInput);

  const handleReturnToCall = React.useCallback(() => {
    if (!activeCallAssistantId) return;
    navigateToAssistantChat(activeCallAssistantId);
    redock();
  }, [activeCallAssistantId, navigateToAssistantChat, redock]);

  return (
    <AssistantFloatingChat
      assistant={assistant}
      assistantActions={assistantActions}
      chatHistories={chatHistories}
      setChatHistories={setChatHistories}
      callPillHistories={callPillHistories}
      setCallPillHistories={setCallPillHistories}
      userEmail={userEmail}
      userTimezone={userTimezone}
      spendingGate={spendingGate}
      chatStreamConnectionStatus={chatStreamConnectionStatus}
      reconnectChatStream={reconnectChatStream}
      chatStreamActivitySignal={chatStreamActivitySignal}
      unreadCount={unreadCount}
      visible={visible}
      hasActiveCall={hasActiveCall}
      isInActiveCall={isInActiveCall}
      isCallConnected={isCallConnected}
      onReturnToCall={hasActiveCall ? handleReturnToCall : undefined}
      onExpandedChange={(expanded) => onExpandedChange(visible && expanded)}
    />
  );
}
