'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { RAIL_FLUSH_PAD } from '@/components/Layout/Shell/railGeometry';
import { Skeleton } from '@/components/UI/skeleton';
import { AssistantSwitcher } from '@/components/Layout/Shell/AssistantSwitcher';
import { useAssistantSwitcherBridge } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import { CHAT_SECTION } from '@/components/Pages/Assistants/Rail/sectionConfig';

interface GlobalUnitySwitcherProps {
  collapsed: boolean;
}

/**
 * Unity switcher for non-assistant home routes. Reads live assistant list
 * state from the hidden-but-mounted assistants runtime via the bridge.
 */
export function GlobalUnitySwitcher({ collapsed }: GlobalUnitySwitcherProps) {
  const bridge = useAssistantSwitcherBridge();
  const { navigateToAssistants } = useAppShellNavigation();

  const handleOpenChat = React.useCallback(() => {
    navigateToAssistants({ sectionId: CHAT_SECTION.id });
  }, [navigateToAssistants]);

  if (!bridge?.listProps) {
    return (
      <div
        className={cn(
          'mb-2 flex items-center gap-3',
          collapsed ? 'mx-auto justify-center p-1.5' : cn(RAIL_FLUSH_PAD, 'py-1.5')
        )}
        data-testid="rail-unity-switcher-loading"
      >
        <Skeleton className="rounded-control h-10 w-10 shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        )}
      </div>
    );
  }

  return (
    <AssistantSwitcher
      activeUnity={bridge.activeUnity}
      activeEntityFace={bridge.activeEntityFace ?? null}
      listProps={bridge.listProps}
      nestedOverlayOpen={bridge.nestedOverlayOpen === true}
      collapsed={collapsed}
      onOpenChat={handleOpenChat}
      chatActive={false}
      activeCallAssistantId={bridge.activeCallAssistantId ?? null}
    />
  );
}
