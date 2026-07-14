'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSidePanel } from '@/components/Pages/Assistants/Chat/ChatSidePanel';
import {
  ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT,
  ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT,
  consumePendingInfoPanelOpen,
  publishAssistantInfoPanelVisibility,
  type AssistantInfoPanelOpenRequestDetail,
  type AssistantInfoPanelToggleRequestDetail,
} from '@/lib/assistants/infoPanelVisibility';
import { matchesBelowBreakpoint } from '@/constants/breakpoints';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { Sheet, SheetContent } from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';

const INFO_PANEL_OPEN_KEY = 'console:assistants:info-panel-open';
const INFO_PANEL_WIDTH_KEY = 'console:assistants:info-panel-width';
const INFO_PANEL_DEFAULT_WIDTH = 360;
const INFO_PANEL_MIN_WIDTH = 280;
const INFO_PANEL_MIN_MAIN_WIDTH = 280;

function clampInfoPanelWidth(width: number, maxWidth = Number.POSITIVE_INFINITY): number {
  return Math.min(maxWidth, Math.max(INFO_PANEL_MIN_WIDTH, Math.round(width)));
}

function isMobileInfoPanelViewport(): boolean {
  return matchesBelowBreakpoint('mobile');
}

function readInfoPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_OPEN_KEY);
    return raw === null ? true : raw !== 'false';
  } catch {
    return true;
  }
}

function writeInfoPanelOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INFO_PANEL_OPEN_KEY, open ? 'true' : 'false');
  } catch {
    /* best-effort persistence */
  }
}

function readInfoPanelWidth(): number {
  if (typeof window === 'undefined') return INFO_PANEL_DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampInfoPanelWidth(parsed) : INFO_PANEL_DEFAULT_WIDTH;
  } catch {
    return INFO_PANEL_DEFAULT_WIDTH;
  }
}

function writeInfoPanelWidth(width: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INFO_PANEL_WIDTH_KEY, String(clampInfoPanelWidth(width)));
  } catch {
    /* width persistence is optional */
  }
}

export interface EntityInfoPanelRenderContext {
  onClose: () => void;
  hideHeaderActions: boolean;
}

interface EntityInfoPanelLayoutProps {
  /** Selection key (`human:…` / `team:…`) used by the top-nav Show profile shortcut. */
  entityId: string;
  children: React.ReactNode;
  renderPanel: (context: EntityInfoPanelRenderContext) => React.ReactNode;
  /** False when the assistants surface is hidden behind settings/admin routes. */
  isActiveSurface?: boolean;
  ariaLabel?: string;
}

/**
 * Side-panel chrome for human and team selections. Mirrors the assistant
 * info panel open/resize/visibility contract so the top-nav Show profile
 * shortcut works for non-assistant entities.
 */
export function EntityInfoPanelLayout({
  entityId,
  children,
  renderPanel,
  isActiveSurface = true,
  ariaLabel = 'Profile',
}: EntityInfoPanelLayoutProps) {
  const isBelowShellCompact = useMatchesBelow('shellCompact');
  const useOverlayInfoPanel = isBelowShellCompact || !isActiveSurface;
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const infoPanelContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [infoPanelWidth, setInfoPanelWidth] = React.useState(INFO_PANEL_DEFAULT_WIDTH);
  const [isResizingInfoPanel, setIsResizingInfoPanel] = React.useState(false);
  const initializedForRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setInfoPanelWidth(readInfoPanelWidth());
  }, []);

  const setIsInfoOpenAndPersist = React.useCallback((next: boolean) => {
    setIsInfoOpen(next);
    writeInfoPanelOpen(next);
  }, []);

  const closeInfo = React.useCallback(
    () => setIsInfoOpenAndPersist(false),
    [setIsInfoOpenAndPersist]
  );

  const getInfoPanelMaxWidth = React.useCallback(() => {
    const container = infoPanelContainerRef.current;
    if (!container) return Number.POSITIVE_INFINITY;
    const { width } = container.getBoundingClientRect();
    return Math.max(INFO_PANEL_MIN_WIDTH, width - INFO_PANEL_MIN_MAIN_WIDTH);
  }, []);

  const setInfoPanelWidthWithinBounds = React.useCallback(
    (width: number) => {
      const next = clampInfoPanelWidth(width, getInfoPanelMaxWidth());
      setInfoPanelWidth(next);
      writeInfoPanelWidth(next);
    },
    [getInfoPanelMaxWidth]
  );

  React.useEffect(() => {
    if (!entityId) return;
    const onToggleRequest = (event: Event) => {
      const detail = (event as CustomEvent<AssistantInfoPanelToggleRequestDetail>).detail;
      if (detail.assistantId !== entityId) return;
      event.preventDefault();
      setIsInfoOpenAndPersist(!isInfoOpen);
    };
    const onOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<AssistantInfoPanelOpenRequestDetail>).detail;
      if (detail.assistantId !== entityId) return;
      setIsInfoOpenAndPersist(true);
    };

    window.addEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, onToggleRequest);
    window.addEventListener(ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, onToggleRequest);
      window.removeEventListener(ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT, onOpenRequest);
    };
  }, [entityId, isInfoOpen, setIsInfoOpenAndPersist]);

  React.useEffect(() => {
    if (!entityId) return;
    if (initializedForRef.current === entityId) return;
    initializedForRef.current = entityId;

    if (isMobileInfoPanelViewport()) {
      setIsInfoOpen(false);
      return;
    }

    if (consumePendingInfoPanelOpen(entityId)) {
      setIsInfoOpenAndPersist(true);
      return;
    }

    setIsInfoOpen(readInfoPanelOpen());
  }, [entityId, setIsInfoOpenAndPersist]);

  React.useEffect(() => {
    if (!entityId) return;
    publishAssistantInfoPanelVisibility({
      assistantId: entityId,
      isOpen: isInfoOpen,
      isCoordinatorOnboarding: false,
      showOnboardingDot: false,
    });
  }, [entityId, isInfoOpen]);

  const handleInfoPanelResizeKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(infoPanelWidth + 24);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(infoPanelWidth - 24);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(INFO_PANEL_MIN_WIDTH);
      } else if (e.key === 'End') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(getInfoPanelMaxWidth());
      }
    },
    [getInfoPanelMaxWidth, infoPanelWidth, setInfoPanelWidthWithinBounds]
  );

  const handleInfoPanelResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const container = infoPanelContainerRef.current;
      if (!container) return;

      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const maxWidth = Math.max(INFO_PANEL_MIN_WIDTH, rect.width - INFO_PANEL_MIN_MAIN_WIDTH);
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let nextWidth = clampInfoPanelWidth(infoPanelWidth, maxWidth);

      setIsResizingInfoPanel(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        nextWidth = clampInfoPanelWidth(rect.right - ev.clientX, maxWidth);
        setInfoPanelWidth(nextWidth);
      };

      const onUp = () => {
        setIsResizingInfoPanel(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        writeInfoPanelWidth(nextWidth);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [infoPanelWidth]
  );

  const infoPanelStyle = React.useMemo<React.CSSProperties>(
    () => ({ ['--chat-side-panel-width']: `${infoPanelWidth}px` }) as React.CSSProperties,
    [infoPanelWidth]
  );

  const panelContext = React.useMemo<EntityInfoPanelRenderContext>(
    () => ({
      onClose: closeInfo,
      hideHeaderActions: useOverlayInfoPanel,
    }),
    [closeInfo, useOverlayInfoPanel]
  );

  const infoPanelBody = renderPanel(panelContext);

  return (
    <div ref={infoPanelContainerRef} className="flex h-full min-h-0 w-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>

      {useOverlayInfoPanel ? (
        <Sheet
          open={isInfoOpen}
          onOpenChange={(open) => {
            if (!open) closeInfo();
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full max-w-[min(100vw,28rem)] flex-col overflow-hidden p-0 sm:max-w-md [&>button.absolute]:hidden"
            data-testid="entity-info-sheet"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={closeInfo}
                aria-label="Close profile"
                data-testid="entity-info-close"
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="h-8 w-8 shrink-0" aria-hidden="true" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{infoPanelBody}</div>
          </SheetContent>
        </Sheet>
      ) : (
        isInfoOpen && (
          <ChatSidePanel
            ariaLabel={ariaLabel}
            onClose={closeInfo}
            style={infoPanelStyle}
            testId="entity-info-sheet"
          >
            <div
              role="separator"
              aria-label="Resize profile panel"
              aria-orientation="vertical"
              aria-valuemin={INFO_PANEL_MIN_WIDTH}
              aria-valuenow={infoPanelWidth}
              tabIndex={0}
              onKeyDown={handleInfoPanelResizeKeyDown}
              onPointerDown={handleInfoPanelResizeStart}
              className={cn(
                'absolute inset-y-0 -left-1 z-20 hidden w-2 cursor-col-resize touch-none bg-transparent transition-colors duration-200 sm:block',
                'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:content-[""]',
                'hover:bg-primary-tint-20 focus-visible:bg-primary-tint-20 focus-visible:outline-none active:bg-primary-tint-40',
                isResizingInfoPanel && 'bg-primary-tint-40'
              )}
              data-testid="entity-info-panel-resize-handle"
            />
            {infoPanelBody}
          </ChatSidePanel>
        )
      )}
    </div>
  );
}
