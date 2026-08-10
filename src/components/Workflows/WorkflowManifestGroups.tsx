'use client';

import {
  AlertTriangle,
  BookOpen,
  Braces,
  ChevronRight,
  Clock3,
  Compass,
  Database,
  Frame,
  ListTodo,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import { Badge } from '@/components/UI/badge';
import { cn } from '@/lib/utils';
import { WORKFLOW_SURFACES, WORKFLOW_SURFACE_ORDER } from './workflowCategories';
import type { Workflow, WorkflowInstallation, WorkflowSurfaceKind } from '@/types/workflows';

const SURFACE_ICON = {
  compass: Compass,
  braces: Braces,
  listTodo: ListTodo,
  bookOpen: BookOpen,
  frame: Frame,
  database: Database,
} as const;

/**
 * "What it sets up" — a MANIFEST WITH LINKS OUT. This is the component that
 * enforces the invariant: the Workflows surface owns nothing.
 *
 * Rules, do not break them:
 *  · no workflow-level Run button — running means running one of its tasks, and
 *    that control lives on the task page. Each task row links there.
 *  · no execution history here — run history is per task and already exists.
 *  · nothing is editable here — planted objects are edited where they live.
 *
 * Recurring tasks show schedule in plain language plus armed/held and next run,
 * because that is install state, not execution history.
 */
export function WorkflowManifestGroups({
  workflow,
  installation,
  defaultOpen = ['tasks'],
  onNavigate,
  onPreview,
}: {
  workflow: Workflow;
  installation?: WorkflowInstallation;
  defaultOpen?: WorkflowSurfaceKind[];
  /** Opens the rail section where this surface lives. */
  onNavigate?: (kind: WorkflowSurfaceKind) => void;
  /**
   * Previews one item in place (a nested sheet above the drawer). When
   * given, it is the row's click; navigation lives inside the preview.
   * Rows are inert with neither handler.
   */
  onPreview?: (kind: WorkflowSurfaceKind, name: string) => void;
}) {
  const groups = WORKFLOW_SURFACE_ORDER.filter((kind) => (workflow.sets[kind]?.length ?? 0) > 0);

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="flex flex-col gap-2">
      {groups.map((kind) => {
        const surface = WORKFLOW_SURFACES[kind];
        const SurfaceIcon = SURFACE_ICON[surface.icon];
        const items = installation?.planted?.[kind] ?? workflow.sets[kind] ?? [];
        const failures = (installation?.failures ?? []).filter((failure) => failure.kind === kind);

        return (
          <AccordionItem
            key={kind}
            value={kind}
            className="overflow-hidden rounded-xl border bg-card-2"
          >
            <AccordionTrigger className="gap-2.5 px-3 py-2.5 hover:no-underline">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                <SurfaceIcon className="h-[15px] w-[15px]" />
              </span>
              <span className="text-h3 flex-1 text-left">
                {surface.label}
                <span className="text-caption ml-2 font-normal">lives in {surface.livesIn}</span>
              </span>
              {failures.length > 0 && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 rounded-full border-transparent bg-[color:var(--status-danger-bg)] text-[10px] uppercase text-destructive"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {failures.length} failed
                </Badge>
              )}
              <Badge
                variant="outline"
                className="shrink-0 rounded-full font-mono text-[11px] text-muted-foreground"
              >
                {items.length}
              </Badge>
            </AccordionTrigger>

            <AccordionContent className="divide-y border-t p-0">
              {items.map((item) => {
                const runtime =
                  kind === 'tasks'
                    ? installation?.tasks.find((task) => task.name === item.name)
                    : undefined;
                const failure = failures.find((entry) => entry.name === item.name);
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm font-medium',
                          (kind === 'functions' || kind === 'tables') && 'font-mono text-xs',
                          failure && 'text-destructive'
                        )}
                      >
                        {item.name}
                      </span>

                      {kind === 'tasks' && (
                        <span className="text-caption mt-1 flex flex-wrap items-center gap-2">
                          <Clock3 className="h-3 w-3" />
                          {item.schedule}
                          {runtime && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={cn(
                                  'rounded-full px-1.5 py-px text-[10px] font-semibold uppercase',
                                  runtime.enabled
                                    ? 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]'
                                    : 'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]'
                                )}
                              >
                                {runtime.enabled ? 'Armed' : 'Held'}
                              </span>
                              <span aria-hidden="true">·</span>
                              next {runtime.nextRunLabel}
                            </>
                          )}
                        </span>
                      )}

                      {failure && (
                        <span className="text-caption mt-1 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          {failure.reason}
                        </span>
                      )}
                    </span>

                    {(onPreview || onNavigate) && (
                      <span className="text-label text-strong flex shrink-0 items-center gap-1 text-accent-soft-foreground opacity-0 transition group-hover/item:opacity-100 group-focus-visible/item:opacity-100">
                        {onPreview ? 'Preview' : `Open in ${surface.livesIn}`}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                  </>
                );

                const rowClass = cn(
                  'group/item flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-muted/40',
                  runtime && !runtime.enabled && 'opacity-70'
                );

                const onRowClick = onPreview
                  ? () => onPreview(kind, item.name)
                  : onNavigate
                    ? () => onNavigate(kind)
                    : undefined;

                return onRowClick ? (
                  <button
                    key={item.name}
                    type="button"
                    className={cn(
                      rowClass,
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                    )}
                    onClick={onRowClick}
                    data-testid={`workflow-manifest-open-${kind}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={item.name} className={rowClass}>
                    {body}
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
