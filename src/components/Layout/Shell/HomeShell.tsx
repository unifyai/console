'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { AppRail, RAIL_COLLAPSED_STORAGE_KEY } from './AppRail';
import { GlobalUnitySwitcher } from './GlobalUnitySwitcher';
import { MobileShellRailProvider, useMobileShellRail } from './MobileShellRailContext';
import { useAssistantSwitcherBridge } from './AssistantSwitcherBridgeContext';
import type { SectionDef } from '@/components/Pages/Assistants/Rail/sectionConfig';
import { parseSelectedEntityKey } from '@/lib/assistants/selectedEntity';
import { useBreakpoint } from '@/hooks/Common/useMobile';
import { Sheet, SheetContent } from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import { cn } from '@/lib/utils';

interface HomeShellProps {
  children: React.ReactNode;
  /** When true, the route body owns its own rail (e.g. `/assistants`). */
  hideGlobalRail?: boolean;
}

/**
 * The global home shell for non-assistant routes: renders the shared `AppRail`
 * (with a read-only unity switcher) beside the route body, so the rail persists
 * across the app. Workspace/Brain sections route to `/assistants`; the rail foot
 * owns Settings/Admin/account navigation.
 */
export function HomeShell({ children, hideGlobalRail = false }: HomeShellProps) {
  const { navigateToAssistants } = useAppShellNavigation();
  const { isBelowMobile, isBelowTablet } = useBreakpoint();
  const bridge = useAssistantSwitcherBridge();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileRailOpen, setMobileRailOpen] = React.useState(false);

  const entityKind = React.useMemo(() => {
    const selectionKey =
      bridge?.listProps?.selectedEntityKey ?? bridge?.listProps?.profileAssistantId ?? null;
    return parseSelectedEntityKey(selectionKey)?.kind ?? 'assistant';
  }, [bridge?.listProps?.profileAssistantId, bridge?.listProps?.selectedEntityKey]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY);
    if (stored != null) {
      setCollapsed(stored === '1');
    } else if (isBelowTablet) {
      setCollapsed(true);
    }
  }, [isBelowTablet]);

  React.useEffect(() => {
    if (isBelowTablet) {
      setCollapsed(true);
    }
  }, [isBelowTablet]);

  React.useEffect(() => {
    if (!isBelowMobile) {
      setMobileRailOpen(false);
    }
  }, [isBelowMobile]);

  const handleCollapsedChange = React.useCallback((next: boolean) => {
    setCollapsed(next);
    window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
  }, []);

  const handleSelectSection = React.useCallback(
    (section: SectionDef) => {
      navigateToAssistants({ sectionId: section.id });
      setMobileRailOpen(false);
    },
    [navigateToAssistants]
  );

  const rail = (
    <AppRail
      switcher={<GlobalUnitySwitcher collapsed={isBelowMobile ? false : collapsed} />}
      activeSection={null}
      onSelectSection={handleSelectSection}
      collapsed={isBelowMobile ? false : collapsed}
      entityKind={entityKind}
      onRequestClose={isBelowMobile ? () => setMobileRailOpen(false) : undefined}
      onCollapsedChange={(next) => {
        if (isBelowMobile && next) {
          setMobileRailOpen(false);
          return;
        }
        handleCollapsedChange(next);
      }}
    />
  );

  return (
    <MobileShellRailProvider
      value={{
        isBelowMobile,
        openMobileRail: () => setMobileRailOpen(true),
      }}
    >
      <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
        {isBelowMobile ? (
          <Sheet open={!hideGlobalRail && mobileRailOpen} onOpenChange={setMobileRailOpen}>
            <SheetContent side="left" className="w-[min(100vw,258px)] p-0" hideClose>
              {rail}
            </SheetContent>
          </Sheet>
        ) : (
          <div
            className={cn('h-full shrink-0', hideGlobalRail && 'hidden')}
            aria-hidden={hideGlobalRail}
          >
            {rail}
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {children}
        </div>
      </div>
    </MobileShellRailProvider>
  );
}

/** Header control for opening the app rail on narrow settings-family routes. */
export function HomeShellRailToggle({ className }: { className?: string }) {
  const mobileRail = useMobileShellRail();
  if (!mobileRail?.isBelowMobile) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className ?? 'h-8 w-8 shrink-0'}
      aria-label="Open navigation"
      data-testid="rail-mobile-toggle"
      onClick={mobileRail.openMobileRail}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
}
