'use client';

/**
 * The Canvas tab.
 *
 * A picker over the assistant's canvases and one mounted below it. Only the
 * selected canvas is mounted: each one is a live view that runs its own bindings on
 * every render, so mounting a list of them would issue every canvas's queries at
 * once for views nobody is looking at.
 *
 * The title, description, metadata and controls are all chrome, not canvas content.
 * An assistant authors the canvas; what identifies and frames it stays ours.
 */

import * as React from 'react';

import { CanvasView } from '@/components/Canvas/CanvasView';
import { Loader } from '@/components/Common/Loader';
import { useCanvases } from '@/hooks/Assistants/useCanvases';
import type { CanvasListRecord } from '@/lib/client/canvasList';
import type { ContextRoot } from '@/lib/assistants/scope';
import type { Assistant } from '@/types/assistants/assistant';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';

import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { TabFooter } from '../Common/TabFooter';
import { TabToolbar } from '../Common/TabToolbar';
import { CanvasCardHeader, CanvasViewSelector } from './CanvasPaneHeader';

interface CanvasPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/Canvas/Views` only. */
  root?: ContextRoot | null;
  /** False while another tab is showing; gates every read. */
  isVisible?: boolean;
  isActiveSurface?: boolean;
}

/** Only a published canvas is servable, so only a published one is selectable. */
function isServable(record: CanvasListRecord): boolean {
  return (record.status ?? 'published') === 'published';
}

function matches(record: CanvasListRecord, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    record.title.toLowerCase().includes(needle) ||
    (record.description ?? '').toLowerCase().includes(needle)
  );
}

export function CanvasPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  isVisible = true,
  isActiveSurface = true,
}: CanvasPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const [searchValue, setSearchValue] = React.useState('');
  const [selectedToken, setSelectedToken] = React.useState<string | null>(null);
  // Re-reads the selected canvas's record and rows without remounting the frame.
  const [dataRevision, setDataRevision] = React.useState(0);

  // Mounted with forceMount alongside every other tab, so without this the
  // canvas list and each view's rows were fetched on page load whether or not
  // anyone opened the tab. Every sibling pane is gated the same way.
  const dataEnabled = isVisible && isActiveSurface;

  const { canvases, isInitialLoading, isRefreshing, refetch } = useCanvases({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
    enabled: dataEnabled,
  });

  const servable = React.useMemo(() => canvases.filter(isServable), [canvases]);
  const visible = React.useMemo(
    () => servable.filter((record) => matches(record, searchValue)),
    [servable, searchValue]
  );

  // Falls back to the most recently updated canvas, and re-resolves when the
  // selected one is deleted or filtered out of scope rather than leaving the pane
  // pointing at a token that no longer resolves.
  const selected = React.useMemo(
    () => visible.find((record) => record.token === selectedToken) ?? visible[0] ?? null,
    [visible, selectedToken]
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <TabToolbar
        testId="canvas-header"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={tabSearchPlaceholder('canvas')}
        searchTestId="canvas-search"
        searchClearTestId="canvas-search-clear"
        leading={
          servable.length > 0 ? (
            <CanvasViewSelector
              canvases={servable}
              selectedToken={selected?.token ?? null}
              onSelect={setSelectedToken}
              filterQuery={searchValue}
            />
          ) : undefined
        }
        trailing={<BrainScopeDropdown scope={scope} />}
        onRefresh={() => void refetch({ blocking: true })}
        isRefreshing={isRefreshing}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isInitialLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader size={24} />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="text-body-muted">
              {servable.length === 0
                ? 'Ask your teammate to build you a view and it will appear here.'
                : 'No canvas matches that search.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {selected ? (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <CanvasCardHeader
                  record={selected}
                  onRefresh={() => setDataRevision((current) => current + 1)}
                  isRefreshing={isRefreshing}
                />
                {/* Keyed on the token so switching canvases builds a new frame
                    rather than handing a different bundle to a live channel. */}
                <CanvasView
                  key={selected.token}
                  token={selected.token}
                  assistantId={assistantId}
                  revision={dataRevision}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <TabFooter
        testId="canvas-footer"
        count={visible.length}
        total={servable.length}
        singular="canvas"
        plural="canvases"
      />
    </div>
  );
}
