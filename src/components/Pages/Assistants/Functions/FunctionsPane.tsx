'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Code2, Check } from 'lucide-react';
// TODO(wire-backend): Running a function from this view is not wired to any
// backend (it only toasts). Play + toast are only used by the disabled Run
// controls below; restore them with a real function-invocation endpoint.
// import { Play } from 'lucide-react';
// import { toast } from 'sonner';
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
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { FunctionSignatureDocs } from './FunctionSignatureDocs';
import {
  filterFunctions,
  normalizeFunctionSkills,
  shortSignature,
  type FunctionSkill,
  type FunctionKindFilter,
} from '@/utils/assistants/functions';
import { docstringPreview } from '@/utils/assistants/functionDoc';
import type { Assistant } from '@/types/assistants/assistant';

interface FunctionsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

const KINDS: FunctionKindFilter[] = ['All', 'Learned', 'Primitives'];

/** Responsive grid: up to four fixed-width cards per row (no shrinking below card min). */
const FUNCTIONS_GRID_CLASS =
  'box-border grid w-full min-w-0 max-w-full grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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

// TODO(wire-backend): the "Run" drawer tab is not wired to a backend — running
// a function from this view isn't available yet. Restore this panel (and the
// About/Run tab switcher + footer Run button) once a function-invocation
// endpoint exists.
// function FunctionRun({ skill }: { skill: FunctionSkill }) {
//   return (
//     <div className="space-y-4 pr-4" data-testid="function-run-body">
//       <DetailField label="Signature">
//         <AssistantMarkdown>{fencedCode(shortSignature(skill), skill.language)}</AssistantMarkdown>
//       </DetailField>
//       <div className="text-body-muted bg-muted/40 flex items-start gap-2 rounded-lg border p-3 text-sm">
//         <Play className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
//         <span>
//           Running functions directly from this view isn&apos;t available yet. Ask your digital twin
//           in chat to run <span className="font-mono">{skill.name}</span> for you.
//         </span>
//       </div>
//     </div>
//   );
// }

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
  // TODO(wire-backend): restore when the function "Run" tab is wired.
  // const [drawerTab, setDrawerTab] = useState<'about' | 'run'>('about');

  const skills = useMemo(() => normalizeFunctionSkills(functions.rows), [functions.rows]);
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
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={tabSearchPlaceholder('functions')}
        searchTestId="functions-search"
        searchClearTestId="functions-search-clear"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh functions"
        refreshTestId="functions-refresh"
      />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="functions-body">
        {isLoading && skills.length === 0 ? (
          <div className={FUNCTIONS_GRID_CLASS} data-testid="functions-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            No functions found.
          </div>
        ) : (
          <ScrollArea className="h-full w-full min-w-0" viewportClassName="min-w-0 max-w-full">
            <div key={kind} className={FUNCTIONS_GRID_CLASS}>
              {filtered.map((skill) => (
                <button
                  key={`${skill.isPrimitive ? 'p' : 'l'}-${skill.functionId ?? skill.name}`}
                  className="hover:border-primary/40 hover:bg-muted/40 flex min-h-[168px] w-full min-w-[16rem] flex-col gap-2 rounded-[13px] border bg-card p-3.5 text-left transition-colors"
                  onClick={() => {
                    setSelected(skill);
                  }}
                  data-testid={`function-card-${skill.name}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                      <Code2 className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-foreground">
                      {skill.name}
                    </div>
                    <KindBadge isPrimitive={skill.isPrimitive} />
                  </div>

                  {skill.argspec && (
                    <div className="truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {shortSignature(skill)}
                    </div>
                  )}

                  <p className="text-foreground/80 line-clamp-2 flex-1 text-[12px] leading-relaxed">
                    {docstringPreview(skill.docstring) || 'No description.'}
                  </p>

                  <div className="mt-auto flex items-center gap-2.5 pt-0.5">
                    <span className="text-[10.5px] text-muted-foreground">{skill.language}</span>
                    {skill.dependsOn.length > 0 && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-soft-foreground">
                        {skill.dependsOn.length} dep{skill.dependsOn.length !== 1 ? 's' : ''}
                      </span>
                    )}
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
        <SheetContent side="right" className="flex w-full flex-col" data-testid="function-detail">
          <SheetHeader className="shrink-0 space-y-2">
            <div>
              <SheetTitle className="break-all font-mono text-[15px]">{selected?.name}</SheetTitle>
              <SheetDescription className="text-[11px]">
                {selected?.isPrimitive ? 'Primitive' : 'Learned'} · {selected?.language}
              </SheetDescription>
            </div>
            {selected && <FunctionBadges skill={selected} />}
            {/*
              TODO(wire-backend): About/Run tab switcher — the "Run" tab is not
              wired to a backend yet. Restore once function invocation exists.
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
            */}
          </SheetHeader>
          <ScrollArea className="mt-4 min-h-0 flex-1">
            {selected && <FunctionAbout skill={selected} />}
          </ScrollArea>
          {selected && (
            <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t pt-3">
              <CopySignatureButton skill={selected} />
              {/*
                TODO(wire-backend): "Run" function button — not wired to a
                backend (only toasts / toggles a tab). Restore once a
                function-invocation endpoint exists.
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
              */}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
