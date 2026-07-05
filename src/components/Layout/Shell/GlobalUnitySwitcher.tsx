'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';
import { AssistantSwitcher } from '@/components/Layout/Shell/AssistantSwitcher';
import { useAssistantSwitcherBridge } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';

interface GlobalUnitySwitcherProps {
  collapsed: boolean;
}

/**
 * Unity switcher for non-assistant home routes. Reads live assistant list
 * state from the hidden-but-mounted assistants runtime via the bridge.
 */
export function GlobalUnitySwitcher({ collapsed }: GlobalUnitySwitcherProps) {
  const bridge = useAssistantSwitcherBridge();

  if (!bridge?.listProps) {
    return (
      <div
        className={cn(
          'mb-2 flex items-center gap-3',
          collapsed ? 'mx-auto justify-center p-1.5' : 'mx-3.5 px-3 py-2'
        )}
        data-testid="rail-unity-switcher-loading"
      >
        <Skeleton
          className={cn('shrink-0 rounded-full', collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]')}
        />
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
      listProps={bridge.listProps}
      collapsed={collapsed}
    />
  );
}
