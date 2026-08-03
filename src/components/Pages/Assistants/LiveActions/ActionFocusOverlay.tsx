/**
 * ActionFocusOverlay - Floating window that blows a single root action up out
 * of the Actions list.
 *
 * The window is sized by dragging any edge or corner, toggles to fill the
 * viewport, and can hand the same action off to a new browser tab. Its
 * expansion state is local, so opening an action here leaves the underlying
 * list exactly as the user left it.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import { ScrollArea } from '@/components/UI/scroll-area';
import { TooltipProvider } from '@/components/UI/tooltip';
import { ActionNodeItem } from './ActionNodeItem';
import type { SectionToggleSignal } from './ActionNodeItem';
import { useActionFocusRect } from '@/hooks/Assistants/useActionFocusRect';
import type { ActionFocusResizeEdge } from '@/types/assistants/actionFocus';
import type { ActionNode, GetToolLoopEventsFn, LoadChildrenFn } from '@/types/assistants/action';

/**
 * Grab strips inset from the corners so the corner squares below win the
 * overlap and give a true two-axis drag.
 */
const EDGE_HANDLES: Array<{ edge: ActionFocusResizeEdge; label: string; className: string }> = [
  { edge: 'n', label: 'Resize from top edge', className: 'inset-x-4 top-0 h-1.5 cursor-ns-resize' },
  {
    edge: 's',
    label: 'Resize from bottom edge',
    className: 'inset-x-4 bottom-0 h-1.5 cursor-ns-resize',
  },
  {
    edge: 'w',
    label: 'Resize from left edge',
    className: 'inset-y-4 left-0 w-1.5 cursor-ew-resize',
  },
  {
    edge: 'e',
    label: 'Resize from right edge',
    className: 'inset-y-4 right-0 w-1.5 cursor-ew-resize',
  },
];

const CORNER_HANDLES: Array<{ edge: ActionFocusResizeEdge; label: string; className: string }> = [
  {
    edge: 'nw',
    label: 'Resize from top-left corner',
    className: 'left-0 top-0 cursor-nwse-resize',
  },
  {
    edge: 'ne',
    label: 'Resize from top-right corner',
    className: 'right-0 top-0 cursor-nesw-resize',
  },
  {
    edge: 'sw',
    label: 'Resize from bottom-left corner',
    className: 'bottom-0 left-0 cursor-nesw-resize',
  },
  {
    edge: 'se',
    label: 'Resize from bottom-right corner',
    className: 'bottom-0 right-0 cursor-nwse-resize',
  },
];

export interface ActionFocusOverlayProps {
  /** The root action to display. Stays live — it is the node from the tree. */
  node: ActionNode;
  /** Owner user ID for constructing context paths */
  ownerId?: string;
  /** Assistant ID for ToolLoop queries */
  assistantId?: string;
  /** Function to fetch ToolLoop events */
  getToolLoopEvents?: GetToolLoopEventsFn;
  /** Function to lazy-load child events for a node on expand */
  loadChildren?: LoadChildrenFn;
  /** Current search term, carried over for text highlighting */
  searchTerm?: string;
  /** IDs of nodes that matched the current search */
  matchedIds?: Set<string>;
  /** Stop an in-flight root action */
  onStopAction?: (callingId: string) => void;
  /** Open this same action in a new browser tab */
  onOpenInNewTab?: () => void;
  /** Close the overlay */
  onClose: () => void;
  /** Start filling the viewport (used by the new-tab deep link) */
  initiallyMaximized?: boolean;
}

export function ActionFocusOverlay({
  node,
  ownerId,
  assistantId,
  getToolLoopEvents,
  loadChildren,
  searchTerm,
  matchedIds,
  onStopAction,
  onOpenInNewTab,
  onClose,
  initiallyMaximized = false,
}: ActionFocusOverlayProps) {
  const [mounted, setMounted] = React.useState(false);
  const { rect, isMaximized, isResizing, toggleMaximized, startResize } = useActionFocusRect();

  // Expansion is overlay-local: the focused root opens, and steps the user
  // opens in here don't reshuffle the list behind the overlay.
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(
    () => new Set([node.id])
  );
  const [sectionToggleSignal] = React.useState<SectionToggleSignal>({ open: true, gen: 1 });

  const handleExpandedChange = React.useCallback((nodeId: string, expanded: boolean) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(nodeId);
      } else {
        next.delete(nodeId);
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const didApplyInitialMaximize = React.useRef(false);
  React.useEffect(() => {
    if (!mounted || !initiallyMaximized || didApplyInitialMaximize.current) return;
    didApplyInitialMaximize.current = true;
    toggleMaximized();
  }, [mounted, initiallyMaximized, toggleMaximized]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  const headerLabel = node.displayLabel || node.label;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[color:var(--overlay)] backdrop-blur-sm"
      data-testid="action-focus-backdrop"
      // Dismiss on press rather than click: a resize drag that releases over
      // the backdrop would deliver its `click` here (the backdrop is the common
      // ancestor of press and release) and close the window mid-resize.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Action: ${headerLabel}`}
        data-testid="action-focus-overlay"
        data-maximized={isMaximized || undefined}
        className={cn(
          'fixed flex flex-col overflow-hidden border border-border bg-card',
          'shadow-[0_20px_70px_var(--shadow-soft)]',
          isMaximized ? 'rounded-none' : 'rounded-xl',
          isResizing && 'select-none'
        )}
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      >
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
            {headerLabel}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {onOpenInNewTab && (
              <OverlayIconButton
                label="Open action in new tab"
                testId="action-focus-new-tab"
                onClick={onOpenInNewTab}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </OverlayIconButton>
            )}
            <OverlayIconButton
              label={isMaximized ? 'Restore action window' : 'Fill the screen'}
              testId="action-focus-maximize"
              onClick={toggleMaximized}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </OverlayIconButton>
            <OverlayIconButton label="Close action" testId="action-focus-close" onClick={onClose}>
              <X className="h-4 w-4" />
            </OverlayIconButton>
          </div>
        </header>

        <TooltipProvider delayDuration={300}>
          <ScrollArea className="min-h-0 flex-1" viewportTestId="action-focus-scroll-container">
            <div className="min-w-0 p-3" style={{ contain: 'inline-size', maxWidth: '100%' }}>
              <ActionNodeItem
                node={node}
                ownerId={ownerId}
                depth={0}
                expandedNodeIds={expandedNodeIds}
                onExpandedChange={handleExpandedChange}
                assistantId={assistantId}
                getToolLoopEvents={getToolLoopEvents}
                loadChildren={loadChildren}
                sectionToggleSignal={sectionToggleSignal}
                matchedIds={matchedIds}
                searchTerm={searchTerm}
                onStopAction={onStopAction}
              />
            </div>
          </ScrollArea>
        </TooltipProvider>

        {EDGE_HANDLES.map(({ edge, label, className }) => (
          <div
            key={edge}
            aria-label={label}
            data-testid={`action-focus-resize-${edge}`}
            onPointerDown={(event) => startResize(event, edge)}
            className={cn(
              'absolute z-10 touch-none bg-transparent transition-colors',
              'hover:bg-primary-tint-20 active:bg-primary-tint-40',
              className
            )}
          />
        ))}
        {CORNER_HANDLES.map(({ edge, label, className }) => (
          <div
            key={edge}
            aria-label={label}
            data-testid={`action-focus-resize-${edge}`}
            onPointerDown={(event) => startResize(event, edge)}
            className={cn('absolute z-20 h-4 w-4 touch-none bg-transparent', className)}
          />
        ))}
      </section>
    </div>,
    document.body
  );
}

function OverlayIconButton({
  label,
  testId,
  onClick,
  children,
}: {
  label: string;
  testId: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
        'transition-colors hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
