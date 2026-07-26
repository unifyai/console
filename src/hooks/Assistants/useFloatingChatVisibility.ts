'use client';

import * as React from 'react';
import { isAssistantsPath } from '@/lib/navigation/appShellRoutes';
import type { Assistant } from '@/types/assistants/assistant';

export interface FloatingChatVisibilityInput {
  pathname: string;
  isBelowTablet: boolean;
  isHireDialogOpen: boolean;
  showCoordinatorOnboardingIntro: boolean;
  isChatVisibleInRightPane: boolean;
  hasActiveCallPoppedOut: boolean;
  profileAssistant: Assistant | null;
  assistantsBootstrapped: boolean;
}

export function isFullPageAssistantChatVisible(input: {
  pathname: string;
  isChatVisibleInRightPane: boolean;
}): boolean {
  return isAssistantsPath(input.pathname) && input.isChatVisibleInRightPane;
}

/**
 * Session dismiss for the floating chat. Clears when the user leaves the
 * full-page Chat tab on /assistants after having entered it — not on mere
 * cross-route navigation.
 */
export function useFloatingChatDismissReset(input: {
  pathname: string;
  isChatVisibleInRightPane: boolean;
}) {
  const { pathname, isChatVisibleInRightPane } = input;
  const [dismissed, setDismissed] = React.useState(false);
  const wasInFullPageChatRef = React.useRef(false);

  React.useEffect(() => {
    const inFullPageChat = isFullPageAssistantChatVisible({
      pathname,
      isChatVisibleInRightPane,
    });
    if (wasInFullPageChatRef.current && !inFullPageChat) {
      setDismissed(false);
    }
    wasInFullPageChatRef.current = inFullPageChat;
  }, [pathname, isChatVisibleInRightPane]);

  const dismiss = React.useCallback(() => {
    setDismissed(true);
  }, []);

  return { dismissed, dismiss };
}

export function useFloatingChatVisibility(input: FloatingChatVisibilityInput): boolean {
  const {
    pathname,
    isBelowTablet,
    isHireDialogOpen,
    showCoordinatorOnboardingIntro,
    isChatVisibleInRightPane,
    hasActiveCallPoppedOut,
    profileAssistant,
    assistantsBootstrapped,
  } = input;

  return React.useMemo(() => {
    if (isBelowTablet) return false;
    if (!assistantsBootstrapped || !profileAssistant) return false;
    if (isHireDialogOpen) return false;
    if (showCoordinatorOnboardingIntro) return false;
    if (hasActiveCallPoppedOut) return false;
    if (isAssistantsPath(pathname) && isChatVisibleInRightPane) return false;
    return true;
  }, [
    assistantsBootstrapped,
    hasActiveCallPoppedOut,
    isBelowTablet,
    isChatVisibleInRightPane,
    isHireDialogOpen,
    pathname,
    profileAssistant,
    showCoordinatorOnboardingIntro,
  ]);
}

/** True when full-page chat owns the conversation (floater should fade out). */
export function useFloatingChatHiddenByFullPage(input: FloatingChatVisibilityInput): boolean {
  const eligible = useFloatingChatVisibility(input);
  const onAssistantsChat =
    isAssistantsPath(input.pathname) && input.isChatVisibleInRightPane && !!input.profileAssistant;
  return !eligible && onAssistantsChat;
}

export const FLOATING_CHAT_COLLAPSED_STORAGE_KEY = 'console:floating-chat-collapsed';
export const FLOATING_CHAT_ENABLED_STORAGE_KEY = 'console:floating-chat-enabled';
export const FLOATING_CHAT_OPT_OUT_PROMPTED_STORAGE_KEY = 'console:floating-chat-opt-out-prompted';
/** Same-tab sync when the enabled preference changes (storage events are cross-tab only). */
export const FLOATING_CHAT_ENABLED_CHANGE_EVENT = 'console:floating-chat-enabled-change';

export function readFloatingChatCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(FLOATING_CHAT_COLLAPSED_STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function writeFloatingChatCollapsedPreference(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLOATING_CHAT_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Whether the floating chat should auto-appear when leaving full-page chat. Default on. */
export function readFloatingChatEnabledPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(FLOATING_CHAT_ENABLED_STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function writeFloatingChatEnabledPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLOATING_CHAT_ENABLED_STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(FLOATING_CHAT_ENABLED_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

/** True once the user has answered (or skipped via settings) the first-dismiss opt-out prompt. */
export function readFloatingChatOptOutPrompted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FLOATING_CHAT_OPT_OUT_PROMPTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeFloatingChatOptOutPrompted(prompted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLOATING_CHAT_OPT_OUT_PROMPTED_STORAGE_KEY, prompted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/**
 * Reactive floating-chat enabled preference (localStorage + same-tab event).
 * Writing also marks the opt-out prompt as answered so dismiss doesn't re-ask.
 */
export function useFloatingChatEnabledPreference(): {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const [enabled, setEnabledState] = React.useState(readFloatingChatEnabledPreference);

  React.useEffect(() => {
    const sync = () => setEnabledState(readFloatingChatEnabledPreference());
    window.addEventListener(FLOATING_CHAT_ENABLED_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FLOATING_CHAT_ENABLED_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setEnabled = React.useCallback((next: boolean) => {
    writeFloatingChatEnabledPreference(next);
    writeFloatingChatOptOutPrompted(true);
    setEnabledState(next);
  }, []);

  return { enabled, setEnabled };
}
