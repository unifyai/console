'use client';

/**
 * The Canvas tab.
 *
 * A picker over the assistant's canvases and one mounted below it. Only the
 * selected canvas is mounted: each one is a live view that runs its own bindings on
 * every render, so mounting a list of them would issue every canvas's queries at
 * once for views nobody is looking at.
 *
 * The title and description are chrome here, not canvas content. An assistant
 * authors the canvas; what names it in the interface stays ours.
 */

import * as React from 'react';

import { CanvasView } from '@/components/Canvas/CanvasView';
import { Loader } from '@/components/Common/Loader';
import { useCanvases } from '@/hooks/Assistants/useCanvases';
import type { CanvasListRecord } from '@/lib/client/canvasList';
import type { ContextRoot } from '@/lib/assistants/scope';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';

import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { TabFooter } from '../Common/TabFooter';
import { TabToolbar } from '../Common/TabToolbar';

interface CanvasPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/Canvas/Views` only. */
  root?: ContextRoot | null;
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

function CanvasRow({
  record,
  isSelected,
  onSelect,
}: {
  record: CanvasListRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected}
      className={cn(
        'flex w-full flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors',
        isSelected ? 'border-primary bg-primary-tint-10' : 'hover:bg-muted/50 border-border bg-card'
      )}
    >
      <span className="text-title truncate text-foreground">{record.title}</span>
      {record.description ? (
        <span className="text-caption line-clamp-2 text-muted-foreground">
          {record.description}
        </span>
      ) : null}
    </button>
  );
}

export function CanvasPane({ assistant, ownerId, assistantId, root = null }: CanvasPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const [searchValue, setSearchValue] = React.useState('');
  const [selectedToken, setSelectedToken] = React.useState<string | null>(null);

  const { canvases, isInitialLoading, isRefreshing, refetch } = useCanvases({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
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
            {visible.length > 1 ? (
              <div className="flex flex-col gap-2">
                {visible.map((record) => (
                  <CanvasRow
                    key={record.token}
                    record={record}
                    isSelected={record.token === selected?.token}
                    onSelect={() => setSelectedToken(record.token)}
                  />
                ))}
              </div>
            ) : null}

            {selected ? (
              <div className="flex flex-col gap-2">
                <header className="flex flex-col gap-0.5">
                  <h2 className="text-title text-foreground">{selected.title}</h2>
                  {selected.description ? (
                    <p className="text-caption text-muted-foreground">{selected.description}</p>
                  ) : null}
                </header>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {/* Keyed on the token so switching canvases builds a new frame
                      rather than handing a different bundle to a live channel. */}
                  <CanvasView
                    key={selected.token}
                    token={selected.token}
                    assistantId={assistantId}
                  />
                </div>
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
