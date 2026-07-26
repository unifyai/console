'use client';

import * as React from 'react';
import { Skeleton } from '@/components/UI/skeleton';
import { AssistantSwitcher } from '@/components/Layout/Shell/AssistantSwitcher';
import { useAssistantSwitcherBridge } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';

/**
 * Unity switcher for non-assistant home routes. Reads live assistant list
 * state from the hidden-but-mounted assistants runtime via the bridge.
 */
export function GlobalUnitySwitcher() {
  const bridge = useAssistantSwitcherBridge();
  const { navigateToAssistants } = useAppShellNavigation();

  const handleOpenChat = React.useCallback(() => {
    navigateToAssistants({ sectionId: 'chat' });
  }, [navigateToAssistants]);

  if (!bridge?.listProps) {
    return (
      <div
        className="mx-auto mb-2 flex items-center justify-center p-1.5"
        data-testid="rail-unity-switcher-loading"
      >
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      </div>
    );
  }

  return (
    <AssistantSwitcher
      activeUnity={bridge.activeUnity}
      activeEntityFace={bridge.activeEntityFace ?? null}
      listProps={bridge.listProps}
      nestedOverlayOpen={bridge.nestedOverlayOpen === true}
      onOpenChat={handleOpenChat}
      chatActive={false}
    />
  );
}
