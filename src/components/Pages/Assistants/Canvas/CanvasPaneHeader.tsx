'use client';

/**
 * Header pieces for the Canvas tab: the view selector, and the chrome around one
 * mounted canvas.
 *
 * Everything here is console's own. A canvas cannot draw its own title, badges,
 * metadata or controls — that is what makes them trustworthy, and it is the same
 * reason `<Canvas>` has no `title` prop and the confirmation dialog lives outside
 * the frame. What the assistant authors is the content; what identifies and frames
 * it stays ours.
 */

import * as React from 'react';
import {
  Activity,
  Check,
  ChevronsUpDown,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/UI/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import type { CanvasListRecord } from '@/lib/client/canvasList';
import { cn } from '@/lib/utils';

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

/**
 * Picker over the assistant's canvases.
 *
 * A combobox over this assistant's canvases, taking the toolbar's search text as a
 * filter rather than owning a search field of its own — typing in the tab's one
 * search box narrows the list, which is what the other tabs do.
 */
export function CanvasViewSelector({
  canvases,
  selectedToken,
  onSelect,
  filterQuery = '',
}: {
  canvases: CanvasListRecord[];
  selectedToken: string | null;
  onSelect: (token: string) => void;
  filterQuery?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const query = filterQuery.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!query) return canvases;
    return canvases.filter(
      (canvas) => matchesQuery(canvas.title, query) || matchesQuery(canvas.description ?? '', query)
    );
  }, [canvases, query]);

  const selectedLabel = React.useMemo(
    () => canvases.find((canvas) => canvas.token === selectedToken)?.title ?? null,
    [canvases, selectedToken]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          // A fixed width, not `flex-1`: the toolbar's leading slot is `shrink-0`,
          // so a flex-grow here has nothing to expand into and collapses the
          // trigger to its minimum. Wide enough for a real canvas title.
          className="h-7 w-56 max-w-[min(100vw,20rem)] justify-between text-xs"
          data-testid="canvas-selector"
        >
          <span className="truncate">{selectedLabel ?? 'Select a canvas...'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        // Sized to the trigger as a floor rather than exactly, so a title longer
        // than the trigger is readable in the list instead of truncated twice.
        className="flex max-h-[min(70vh,28rem)] w-auto min-w-[var(--radix-popover-trigger-width)] max-w-[24rem] flex-col overflow-hidden p-0"
        align="start"
      >
        <Command className="min-h-0 flex-1" shouldFilter={false}>
          <CommandList className="min-h-0 flex-1">
            <CommandEmpty className="py-3 text-xs">No results found.</CommandEmpty>
            <CommandGroup
              heading="Canvases"
              className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
            >
              {filtered.map((canvas) => (
                <CommandItem
                  key={canvas.token}
                  value={`${canvas.title} ${canvas.description ?? ''}`}
                  className="gap-1.5 py-1 text-xs"
                  onSelect={() => {
                    onSelect(canvas.token);
                    setOpen(false);
                  }}
                >
                  <LayoutDashboard className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{canvas.title}</span>
                  <Check
                    className={cn(
                      'ml-auto h-3 w-3 shrink-0',
                      selectedToken === canvas.token ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function formatWhen(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Contexts a canvas is bound to, as a readable list. */
function boundContexts(record: CanvasListRecord): string[] {
  return (record.bindingContexts ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * A stored context path carries its tenant and assistant routing prefix, which
 * identifies nothing to a reader looking at their own canvas. The trailing
 * segments are the table; the full path stays in the tooltip for auditing.
 */
function shortContextName(context: string): string {
  const parts = context.split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : context;
}

/** Chips beyond this fold into a single "+N more" with the rest in its tooltip. */
const MAX_VISIBLE_CONTEXTS = 4;

/**
 * What is known about the selected canvas, from its stored row.
 *
 * Worth showing rather than hiding: which data a canvas can read is the single most
 * useful thing to know about one you did not write, and it is recorded precisely so
 * it can be audited. `visibility` appears only when it is not the private default,
 * so the common case stays quiet. The contexts render as bounded chips rather than
 * flowing text — a canvas over a dozen tables was drowning its own title in paths.
 */
function CanvasMetadata({ record }: { record: CanvasListRecord }) {
  const contexts = boundContexts(record);
  const updated = formatWhen(record.updatedAt);

  const facts: string[] = [];
  if (updated) facts.push(`Updated ${updated}`);
  if (record.visibility && record.visibility !== 'private') facts.push(record.visibility);
  if (record.kitVersion) facts.push(`kit ${record.kitVersion}`);

  const visible = contexts.slice(0, MAX_VISIBLE_CONTEXTS);
  const overflow = contexts.slice(MAX_VISIBLE_CONTEXTS);

  return (
    <div className="text-caption flex flex-col gap-1 text-muted-foreground">
      {facts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {facts.map((fact, index) => (
            <React.Fragment key={fact}>
              {index > 0 ? (
                <span aria-hidden className="opacity-40">
                  ·
                </span>
              ) : null}
              <span>{fact}</span>
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {contexts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="shrink-0" title="Data this canvas is allowed to read">
            Reads
          </span>
          {visible.map((context) => (
            <span
              key={context}
              title={context}
              className="max-w-[16rem] truncate rounded border border-border bg-muted px-1.5 py-px font-mono text-[10px] leading-4"
            >
              {shortContextName(context)}
            </span>
          ))}
          {overflow.length > 0 ? (
            <span
              title={overflow.join('\n')}
              className="rounded border border-border px-1.5 py-px text-[10px] leading-4"
            >
              +{overflow.length} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface CanvasCardHeaderProps {
  record: CanvasListRecord;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Chrome around one mounted canvas.
 *
 * The run-history affordance is deliberately not here: it lives inside
 * `CanvasView`, which holds the run state and is mounted by all three surfaces, so
 * putting a second one here would either duplicate it or make the chat embed and
 * standalone page the only places without it.
 *
 * "Open in new tab" goes to the standalone page rather than the canvas origin
 * directly: the origin serves the runtime host, which is inert without the record,
 * the bindings and the action descriptors console resolves for it.
 */
export function CanvasCardHeader({ record, onRefresh, isRefreshing }: CanvasCardHeaderProps) {
  // A canvas with no binding reads nothing live, so neither badge nor refresh means
  // anything for it.
  const hasBindings = boundContexts(record).length > 0;

  return (
    <div className="flex flex-col gap-1 border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-label min-w-0 flex-1 truncate text-foreground">{record.title}</span>

        {hasBindings ? (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-[color:var(--status-success-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--status-success)]"
            title="Reads live data on every view"
          >
            <Activity className="h-2.5 w-2.5" />
            Live
          </span>
        ) : null}

        {hasBindings ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            data-testid="canvas-refresh"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', isRefreshing && 'animate-spin')} />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-5 w-5 shrink-0"
          title="Open in new tab"
          data-testid="canvas-open-tab"
        >
          <a href={`/canvas/view/${record.token}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </Button>
      </div>

      {record.description ? (
        <p className="text-caption text-muted-foreground">{record.description}</p>
      ) : null}

      <CanvasMetadata record={record} />
    </div>
  );
}
