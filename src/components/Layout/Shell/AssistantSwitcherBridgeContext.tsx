'use client';

import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import type { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';

export const SELECTED_ASSISTANT_STORAGE_KEY = 'console:selected-assistant-id';

export type AssistantSwitcherBridgeValue = {
  activeUnity: Assistant | null;
  listProps: React.ComponentProps<typeof AssistantList> | null;
};

const AssistantSwitcherBridgeContext = React.createContext<{
  bridge: AssistantSwitcherBridgeValue | null;
  setBridge: (value: AssistantSwitcherBridgeValue | null) => void;
} | null>(null);

export function AssistantSwitcherBridgeProvider({ children }: { children: React.ReactNode }) {
  const [bridge, setBridge] = React.useState<AssistantSwitcherBridgeValue | null>(null);
  const value = React.useMemo(() => ({ bridge, setBridge }), [bridge]);
  return (
    <AssistantSwitcherBridgeContext.Provider value={value}>
      {children}
    </AssistantSwitcherBridgeContext.Provider>
  );
}

export function useAssistantSwitcherBridgePublisher() {
  const ctx = React.useContext(AssistantSwitcherBridgeContext);
  if (!ctx) {
    throw new Error(
      'useAssistantSwitcherBridgePublisher must be used within AssistantSwitcherBridgeProvider'
    );
  }
  return ctx.setBridge;
}

export function useAssistantSwitcherBridge(): AssistantSwitcherBridgeValue | null {
  return React.useContext(AssistantSwitcherBridgeContext)?.bridge ?? null;
}

export function readStoredSelectedAssistantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SELECTED_ASSISTANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSelectedAssistantId(assistantId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (assistantId) {
      window.localStorage.setItem(SELECTED_ASSISTANT_STORAGE_KEY, assistantId);
    } else {
      window.localStorage.removeItem(SELECTED_ASSISTANT_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}
