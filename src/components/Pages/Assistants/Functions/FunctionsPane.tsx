'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Code2, Play, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { AssistantMarkdown, fencedCode } from '../Common/AssistantMarkdown';
import { TabToolbar } from '../Common/TabToolbar';
import { TabFooter } from '../Common/TabFooter';
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
        'rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide',
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
      <span className="text-code-sm rounded-full border bg-muted px-2 py-0.5 text-muted-foreground">
        {skill.language}
      </span>
      {skill.verify && (
        <span className="bg-primary/10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-primary">
          <Check className="h-3 w-3" /> verified
        </span>
      )}
    </div>
  );
}

function FunctionAbout({ skill }: { skill: FunctionSkill }) {
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

function CopySignatureButton({ skill }: { skill: FunctionSkill }) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: skill.implementation || shortSignature(skill),
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

function FunctionRun({ skill }: { skill: FunctionSkill }) {
  return (
    <div className="space-y-4 pr-4" data-testid="function-run-body">
      <DetailField label="Signature">
        <AssistantMarkdown>{fencedCode(shortSignature(skill), skill.language)}</AssistantMarkdown>
      </DetailField>
      <div className="text-body-muted bg-muted/40 flex items-start gap-2 rounded-lg border p-3 text-sm">
        <Play className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          Running functions directly from this view isn&apos;t available yet. Ask your digital twin
          in chat to run <span className="font-mono">{skill.name}</span> for you.
        </span>
      </div>
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
  const [drawerTab, setDrawerTab] = useState<'about' | 'run'>('about');

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
      <TabToolbar
        testId="functions-header"
        leading={
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
        }
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search skills…"
        searchTestId="functions-search"
        searchClearTestId="functions-search-clear"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh functions"
        refreshTestId="functions-refresh"
      />

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
                  className="hover:border-primary/40 hover:bg-muted/40 flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-colors"
                  onClick={() => {
                    setDrawerTab('about');
                    setSelected(skill);
                  }}
                  data-testid={`function-card-${skill.name}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-mono text-[11.5px] font-medium text-foreground">
                      {skill.name}
                    </span>
                    <span className="ml-auto">
                      <KindBadge isPrimitive={skill.isPrimitive} />
                    </span>
                  </div>
                  <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                    {shortSignature(skill)}
                  </div>
                  <div className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {skill.docstring || 'No description.'}
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 border-t pt-1.5 text-[10px] text-muted-foreground">
                    <span className="font-mono">{skill.language}</span>
                    {skill.dependsOn.length > 0 && (
                      <span>
                        · {skill.dependsOn.length} dep{skill.dependsOn.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
                      <Play className="h-2.5 w-2.5" /> Run
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <TabFooter
        testId="functions-footer"
        count={filtered.length}
        total={skills.length}
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
          className="flex w-full flex-col sm:!max-w-2xl"
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
            <div className="flex items-center gap-1" data-testid="function-detail-tabs">
              {(['about', 'run'] as const).map((t) => (
                <button
                  key={t}
                  className={SEG_CLASS}
                  data-active={drawerTab === t}
                  onClick={() => setDrawerTab(t)}
                  data-testid={`function-detail-tab-${t}`}
                >
                  {t === 'about' ? 'About' : 'Run'}
                </button>
              ))}
            </div>
          </SheetHeader>
          <ScrollArea className="mt-4 min-h-0 flex-1">
            {selected &&
              (drawerTab === 'about' ? (
                <FunctionAbout skill={selected} />
              ) : (
                <FunctionRun skill={selected} />
              ))}
          </ScrollArea>
          {selected && (
            <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t pt-3">
              <CopySignatureButton skill={selected} />
              {drawerTab === 'about' ? (
                <Button size="sm" onClick={() => setDrawerTab('run')} data-testid="function-run">
                  <Play className="mr-1 h-3.5 w-3.5" /> Run
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    toast('Running functions isn’t available from this view yet.', {
                      description: 'Ask your digital twin in chat to run this function.',
                    })
                  }
                  data-testid="function-run"
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> Run
                </Button>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
