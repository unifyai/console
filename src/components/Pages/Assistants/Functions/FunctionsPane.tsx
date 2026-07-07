'use client';

import React, { useState, useCallback } from 'react';
import { Code2, Check } from 'lucide-react';
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
import type { ContextRoot } from '@/lib/assistants/scope';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { AssistantMarkdown, fencedCode } from '../Common/AssistantMarkdown';
import { TabToolbar } from '../Common/TabToolbar';
import { BrainScopeChips, useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { FunctionSignatureDocs } from './FunctionSignatureDocs';
import { FunctionsVirtualGrid } from './FunctionsVirtualGrid';
import { ScrollArea } from '@/components/UI/scroll-area';
import { FUNCTIONS_GRID_CLASS } from '@/utils/assistants/functionsGrid';
import { type FunctionSkill, type FunctionKindFilter } from '@/utils/assistants/functions';
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

function KindBadge({ isPrimitive }: { isPrimitive: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-[7px] py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em]',
        isPrimitive
          ? 'bg-[color-mix(in_srgb,var(--role-purple)_14%,transparent)] text-[color:var(--role-purple)]'
          : 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]'
      )}
    >
      {isPrimitive ? 'primitive' : 'learned'}
    </span>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="text-[12.5px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function FunctionBadges({ skill }: { skill: FunctionSkill }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="function-badges">
      <KindBadge isPrimitive={skill.isPrimitive} />
      {skill.verify && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--status-success-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--status-success)]">
          <Check className="h-3 w-3" /> verified
        </span>
      )}
    </div>
  );
}

function FunctionAbout({ skill }: { skill: FunctionSkill }) {
  return (
    <div className="space-y-4 pr-4" data-testid="function-detail-body">
      <FunctionSignatureDocs
        argspec={skill.argspec}
        docstring={skill.docstring}
        language={skill.language}
      />

      {skill.dependsOn.length > 0 && (
        <DetailField label="Depends on">
          <div className="flex flex-wrap gap-1.5">
            {skill.dependsOn.map((dep) => (
              <span
                key={dep}
                className="bg-muted/40 text-code-sm rounded-md border px-2 py-0.5 text-muted-foreground"
              >
                {dep}
              </span>
            ))}
          </div>
        </DetailField>
      )}

      {skill.guidanceIds.length > 0 && (
        <DetailField label="Linked guidance">
          <span className="text-caption">
            {skill.guidanceIds.length} linked playbook
            {skill.guidanceIds.length > 1 ? 's' : ''}
          </span>
        </DetailField>
      )}

      {skill.precondition && (
        <DetailField label="Precondition">
          <AssistantMarkdown>
            {fencedCode(JSON.stringify(skill.precondition, null, 2), 'json')}
          </AssistantMarkdown>
        </DetailField>
      )}

      <DetailField label="Implementation">
        {skill.implementation ? (
          <AssistantMarkdown>{fencedCode(skill.implementation, skill.language)}</AssistantMarkdown>
        ) : (
          <p className="text-caption">
            This is a primitive — its implementation lives in the platform&apos;s state-manager
            class, not as stored source.
          </p>
        )}
      </DetailField>
    </div>
  );
}

function CopySignatureButton({ skill }: { skill: FunctionSkill }) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: skill.implementation || skill.argspec,
    copyMessage: 'Copied',
    showSuccessNotification: false,
  });
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} data-testid="function-copy">
      {isCopied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Code2 className="mr-1 h-3.5 w-3.5" />}
      {isCopied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function FunctionsPane({
  assistant,
  ownerId: _ownerId,
  assistantId: _assistantId,
  root = null,
  isActiveSurface = true,
}: FunctionsPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root, includeAll: false });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [kind, setKind] = useState<FunctionKindFilter>('All');
  const [selected, setSelected] = useState<FunctionSkill | null>(null);
  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    committed: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
  } = useTabSearchCommit();

  const { skills, total, hasLoaded, isLoading, isLoadingMore, hasMore, error, loadMore, refetch } =
    useFunctionsCatalog({
      assistant,
      kind,
      query: searchQuery,
      root: scope.root ?? { kind: 'personal' },
      enabled: isActiveSurface,
    });

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
      />
      <BrainScopeChips scope={scope} />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="functions-body">
        {isLoading && !hasLoaded ? (
          <div className={FUNCTIONS_GRID_CLASS} data-testid="functions-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            No functions found.
          </div>
        ) : (
          <FunctionsVirtualGrid
            key={kind}
            skills={skills}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onEndReached={loadMore}
            onSelect={setSelected}
          />
        )}
      </div>

      <TabFooter
        testId="functions-footer"
        count={skills.length}
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
        <SheetContent
          side="right"
          className="flex w-full max-w-[min(100vw,42rem)] flex-col"
          data-testid="function-detail"
        >
          <SheetHeader className="shrink-0 space-y-2">
            <div>
              <SheetTitle className="break-all font-mono text-[15px]">{selected?.name}</SheetTitle>
              <SheetDescription className="text-[11px]">
                {selected?.isPrimitive ? 'Primitive' : 'Learned'} · {selected?.language}
              </SheetDescription>
            </div>
            {selected && <FunctionBadges skill={selected} />}
          </SheetHeader>
          <ScrollArea className="mt-4 min-h-0 flex-1">
            {selected && <FunctionAbout skill={selected} />}
          </ScrollArea>
          {selected && (
            <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t pt-3">
              <CopySignatureButton skill={selected} />
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
