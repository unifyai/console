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
