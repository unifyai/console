'use client';

import * as React from 'react';
import { AppRail } from './AppRail';
import { GlobalUnitySwitcher } from './GlobalUnitySwitcher';
import { useAssistantSwitcherBridge } from './AssistantSwitcherBridgeContext';
import type { SectionDef } from '@/components/Pages/Assistants/Rail/sectionConfig';
import { parseSelectedEntityKey } from '@/lib/assistants/selectedEntity';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import { requestPlatformHomeNavigation } from '@/lib/navigation/platformHome';
import { cn } from '@/lib/utils';

interface HomeShellProps {
  children: React.ReactNode;
  /** When true, the route body owns its own rail (e.g. `/assistants`). */
  hideGlobalRail?: boolean;
}

/**
 * The global home shell for non-assistant routes: renders the shared icon-only
 * `AppRail` beside the route body so the rail persists across the app.
 * Workspace/Brain sections route to `/assistants`; the rail foot owns
 * Settings/Admin/account navigation.
 */
export function HomeShell({ children, hideGlobalRail = false }: HomeShellProps) {
  const { navigateToAssistants } = useAppShellNavigation();
  const bridge = useAssistantSwitcherBridge();

  const entityKind = React.useMemo(() => {
    const selectionKey =
      bridge?.listProps?.selectedEntityKey ?? bridge?.listProps?.profileAssistantId ?? null;
    return parseSelectedEntityKey(selectionKey)?.kind ?? 'assistant';
  }, [bridge?.listProps?.profileAssistantId, bridge?.listProps?.selectedEntityKey]);

  const handleSelectSection = React.useCallback(
    (section: SectionDef) => {
      navigateToAssistants({ sectionId: section.id });
    },
    [navigateToAssistants]
  );

  const handleBrandClick = React.useCallback(() => {
    requestPlatformHomeNavigation();
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
      <div
        className={cn('h-full shrink-0', hideGlobalRail && 'hidden')}
        aria-hidden={hideGlobalRail}
      >
        <AppRail
          switcher={<GlobalUnitySwitcher />}
          activeSection={null}
          onSelectSection={handleSelectSection}
          onBrandClick={handleBrandClick}
          entityKind={entityKind}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </div>
    </div>
  );
}

/** Icon rail is always visible; kept as a no-op for settings header slots. */
export function HomeShellRailToggle(_props: { className?: string }) {
  return null;
}
