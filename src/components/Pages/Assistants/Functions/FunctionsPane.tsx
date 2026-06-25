'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { RefreshCw, Search, X, Code2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { AssistantMarkdown, fencedCode } from '../Common/AssistantMarkdown';
import {
  mapFunctionRow,
  filterFunctions,
  shortSignature,
  type FunctionSkill,
  type FunctionKindFilter,
} from '@/utils/assistants/functions';
import type { Assistant } from '@/types/assistants/assistant';

interface FunctionsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

const KINDS: FunctionKindFilter[] = ['All', 'Learned', 'Primitives'];

const SEG_CLASS = [
  'inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-medium',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
].join(' ');

function KindBadge({ isPrimitive }: { isPrimitive: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium',
        isPrimitive ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
      )}
    >
      {isPrimitive ? 'primitive' : 'learned'}
    </span>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function FunctionDetail({ skill }: { skill: FunctionSkill }) {
  return (
    <div className="space-y-4 pr-4" data-testid="function-detail-body">
      <DetailField label="Signature">
        <AssistantMarkdown>{fencedCode(skill.argspec, skill.language)}</AssistantMarkdown>
      </DetailField>

      {skill.docstring && (
        <DetailField label="Docstring">
          <AssistantMarkdown>{skill.docstring}</AssistantMarkdown>
        </DetailField>
      )}

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

export function FunctionsPane({ assistant, ownerId, assistantId }: FunctionsPaneProps) {
  const { functions, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    contexts: ['Functions'] as const,
    initialContext: 'Functions',
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<FunctionKindFilter>('All');
  const [selected, setSelected] = useState<FunctionSkill | null>(null);

  const skills = useMemo(() => functions.rows.map(mapFunctionRow), [functions.rows]);
  const filtered = useMemo(() => filterFunctions(skills, query, kind), [skills, query, kind]);

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
    <div className="flex h-full flex-col" data-testid="functions-pane">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        data-testid="functions-header"
      >
        <div className="flex items-center gap-1" data-testid="functions-kind-seg">
          {KINDS.map((k) => (
            <button
              key={k}
              className={SEG_CLASS}
              data-active={kind === k}
              data-testid={`functions-kind-${k.toLowerCase()}`}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="functions-search"
          />
          {query && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery('')}
              data-testid="functions-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="functions-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      <div className="min-h-0 flex-1" data-testid="functions-body">
        {isLoading && skills.length === 0 ? (
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-3"
            data-testid="functions-skeleton"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            No functions found.
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-3">
              {filtered.map((skill) => (
                <button
                  key={`${skill.functionId ?? skill.name}`}
                  className="hover:border-primary/40 hover:bg-muted/40 flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors"
                  onClick={() => setSelected(skill)}
                  data-testid={`function-card-${skill.name}`}
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-code truncate font-medium text-foreground">
                      {skill.name}
                    </span>
                    <span className="ml-auto">
                      <KindBadge isPrimitive={skill.isPrimitive} />
                    </span>
                  </div>
                  <div className="text-code-sm truncate text-muted-foreground">
                    {shortSignature(skill)}
                  </div>
                  <div className="text-caption line-clamp-2">
                    {skill.docstring || 'No description.'}
                  </div>
                  <div className="mt-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{skill.language}</span>
                    {skill.dependsOn.length > 0 && (
                      <span>
                        · {skill.dependsOn.length} dep{skill.dependsOn.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <div
        className="flex h-10 shrink-0 items-center justify-end border-t px-2"
        data-testid="functions-footer"
      >
        <span className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline">
          {filtered.length} of {skills.length} {skills.length === 1 ? 'function' : 'functions'}
        </span>
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:!max-w-2xl"
          data-testid="function-detail"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle className="break-all font-mono">{selected?.name}</SheetTitle>
            <SheetDescription>
              {selected?.isPrimitive ? 'Primitive' : 'Learned'} · {selected?.language}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 min-h-0 flex-1">
            {selected && <FunctionDetail skill={selected} />}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
