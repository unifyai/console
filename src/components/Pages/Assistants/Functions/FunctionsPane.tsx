'use client';

import React, { useState, useCallback } from 'react';
import { Code2, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/UI/sheet';
import { cn } from '@/lib/utils';
import { useFunctionsCatalog } from '@/hooks/Assistants/useFunctionsCatalog';
import { usePendingFunctionTarget } from '@/lib/navigation/AppShellRouter';
import type { ContextRoot } from '@/lib/assistants/scope';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { AssistantMarkdown, fencedCode } from '../Common/AssistantMarkdown';
import { StaleReasonChips } from '../Common/StaleReasonChips';
import { TabToolbar } from '../Common/TabToolbar';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import {
  CopySignatureButton,
  FunctionBadges,
  FunctionDetailBody,
  KindBadge,
} from './FunctionDetail';
import { FunctionsVirtualGrid } from './FunctionsVirtualGrid';
import { ScrollArea } from '@/components/UI/scroll-area';
import { FUNCTIONS_GRID_CLASS } from '@/utils/assistants/functionsGrid';
import { type FunctionEntry, type FunctionKindFilter } from '@/utils/assistants/functions';
import type { Assistant } from '@/types/assistants/assistant';

interface FunctionsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/Functions/…`. */
  root?: ContextRoot | null;
  isActiveSurface?: boolean;
}

const KINDS: FunctionKindFilter[] = ['All', 'Learned', 'Primitives'];

export function FunctionsPane({
  assistant,
  ownerId: _ownerId,
  assistantId: _assistantId,
  root = null,
  isActiveSurface = true,
}: FunctionsPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [kind, setKind] = useState<FunctionKindFilter>('All');
  const [selected, setSelected] = useState<FunctionEntry | null>(null);
  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    committed: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
  } = useTabSearchCommit();

  const {
    functions,
    total,
    hasLoaded,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refetch,
  } = useFunctionsCatalog({
    assistant,
    kind,
    query: searchQuery,
    root: scope.root,
    enabled: isActiveSurface,
  });

  const { pendingFunctionId, clearPendingFunction } = usePendingFunctionTarget();

  React.useEffect(() => {
    if (!pendingFunctionId) return;
    setKind('All');
  }, [pendingFunctionId]);

  React.useEffect(() => {
    if (!pendingFunctionId || !hasLoaded || kind !== 'All') return;
    const fn = functions.find((item) => item.functionId === pendingFunctionId);
    if (fn) {
      setSelected(fn);
    }
    clearPendingFunction();
  }, [clearPendingFunction, hasLoaded, kind, pendingFunctionId, functions]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-body-muted text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col" data-testid="functions-pane">
      <TabToolbar
        testId="functions-header"
        leading={
          <TabSegmentGroup testId="functions-kind-seg">
            {KINDS.map((k) => (
              <TabSegment
                key={k}
                label={k}
                active={kind === k}
                onClick={() => setKind(k)}
                testId={`functions-kind-${k.toLowerCase()}`}
              />
            ))}
          </TabSegmentGroup>
        }
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={submitSearch}
        onSearchClear={clearSearch}
        searchPlaceholder={tabSearchPlaceholder('functions')}
        searchTestId="functions-search"
        searchClearTestId="functions-search-clear"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh functions"
        refreshTestId="functions-refresh"
        trailing={<BrainScopeDropdown scope={scope} />}
      />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="functions-body">
        {isLoading && !hasLoaded ? (
          <div className={FUNCTIONS_GRID_CLASS} data-testid="functions-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : functions.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            No functions found.
          </div>
        ) : (
          <FunctionsVirtualGrid
            key={kind}
            functions={functions}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onEndReached={loadMore}
            onSelect={setSelected}
          />
        )}
      </div>

      <TabFooter
        testId="functions-footer"
        count={functions.length}
        total={total}
        singular="function"
        plural="functions"
      />

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent side="right" className="flex flex-col" data-testid="function-detail">
          <SheetHeader className="shrink-0 space-y-2">
            <div>
              <SheetTitle className="break-all font-mono text-[15px]">{selected?.name}</SheetTitle>
              <SheetDescription className="text-[11px]">
                {selected?.isPrimitive ? 'Primitive' : 'Learned'} · {selected?.language}
              </SheetDescription>
            </div>
            {selected && <FunctionBadges fn={selected} />}
          </SheetHeader>
          <ScrollArea className="mt-4 min-h-0 flex-1">
            {selected && <FunctionDetailBody fn={selected} />}
          </ScrollArea>
          {selected && (
            <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t pt-3">
              <CopySignatureButton fn={selected} />
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
