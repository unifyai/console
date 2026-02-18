/**
 * ActionNodeItem - Displays a single action node in the tree.
 *
 * Features:
 * - Status indicator (running/completed/error)
 * - Expand/collapse for child nodes
 * - Duration display
 * - Inline content display (latest thinking while running, final answer when complete)
 * - Sleek, borderless scrollable content area
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Loader2 } from 'lucide-react';
import { StatusIndicator } from './StatusIndicator';
import { formatDuration, getNodeDuration } from '@/utils/assistants/assistant-actions';
import type { ActionNode, GetToolLoopEventsFn, ToolLoopLog } from '@/types/assistants/action';

/** Signal object for expand/collapse all to reach CollapsibleToolLoopSection. */
export type SectionToggleSignal = { open: boolean; gen: number };

export interface ActionNodeItemProps {
  /** The action node to display */
  node: ActionNode;
  /** Depth level for indentation (0 = root) */
  depth?: number;
  /** Default expanded state (defaults to true for running nodes) */
  defaultExpanded?: boolean;
  /** Controlled: set of expanded node IDs */
  expandedNodeIds?: Set<string>;
  /** Controlled: callback when expansion state changes */
  onExpandedChange?: (nodeId: string, expanded: boolean) => void;
  /** Assistant ID for fetching ToolLoop events */
  assistantId?: string;
  /** Function to fetch ToolLoop events (optional) */
  getToolLoopEvents?: GetToolLoopEventsFn;
  /** Signal to force-expand/collapse all ToolLoop step sections */
  sectionToggleSignal?: SectionToggleSignal;
  /** Additional class names */
  className?: string;
}

/**
 * Get label styling based on node type.
 */
function getLabelStyles(type: ActionNode['type']): string {
  switch (type) {
    case 'boundary':
      return 'text-muted-foreground font-normal';
    case 'manager':
    default:
      return 'text-foreground font-medium';
  }
}

/**
 * Extract text content from various formats.
 */
function extractTextContent(
  content: string | Array<{ type: string; text: string }> | undefined
): string | undefined {
  if (!content) return undefined;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('\n');
  }
  return undefined;
}

/**
 * Scrollable content area with sleek styling and fade effect.
 */
function ContentArea({
  content,
  depth,
  maxHeight = 80,
}: {
  content: string;
  depth: number;
  maxHeight?: number;
}) {
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Check if content overflows
  React.useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setIsOverflowing(el.scrollHeight > el.clientHeight);
    }
  }, [content]);

  return (
    <div
      className="relative min-w-0"
      style={{
        paddingLeft: `${28 + depth * 12}px`,
        maxWidth: `calc(100% - ${depth * 12 + 16}px)`,
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          'text-muted-foreground/70 overflow-y-auto text-[11px] leading-relaxed',
          'scrollbar-none hover:scrollbar-thin hover:scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/20'
        )}
        style={{
          maxHeight: `${maxHeight}px`,
          scrollbarWidth: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.style.scrollbarWidth as unknown) = 'thin';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.scrollbarWidth as unknown) = 'none';
        }}
      >
        <span className="whitespace-pre-wrap break-words">{content}</span>
      </div>

      {/* Subtle fade at bottom when overflowing */}
      {isOverflowing && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-4"
          style={{
            paddingLeft: `${28 + depth * 12}px`,
            background: 'linear-gradient(to bottom, transparent, var(--background))',
          }}
        />
      )}
    </div>
  );
}

/**
 * Renders a single ToolLoop message with a role tag and content.
 */
function ToolLoopMessage({ log }: { log: ToolLoopLog }) {
  const { message } = log.entries;

  if (message.role === 'system') return null;

  if (message.role === 'user') {
    const content = extractTextContent(message.content);
    if (!content) return null;
    return (
      <div className="flex gap-2">
        <span className="shrink-0 font-medium text-blue-500/60">request</span>
        <span className="text-muted-foreground/50 whitespace-pre-wrap break-words">{content}</span>
      </div>
    );
  }

  if (message.role === 'assistant') {
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolName = message.toolCalls[0].function.name;
      return (
        <div className="flex gap-2">
          <span className="shrink-0 font-medium text-orange-500/60">call</span>
          <span className="text-muted-foreground/50">{toolName}()</span>
        </div>
      );
    }
    const content = extractTextContent(message.content);
    if (!content) return null;
    return (
      <div className="flex gap-2">
        <span className="shrink-0 font-medium text-green-500/60">response</span>
        <span className="text-muted-foreground/50 whitespace-pre-wrap break-words">{content}</span>
      </div>
    );
  }

  if (message.role === 'tool') {
    const content = extractTextContent(message.content);
    if (!content) return null;
    return (
      <div className="flex gap-2">
        <span className="shrink-0 font-medium text-purple-500/60">result</span>
        <span className="text-muted-foreground/50 whitespace-pre-wrap break-words">{content}</span>
      </div>
    );
  }

  return null;
}

/**
 * Displays the full ToolLoop conversation for a completed node.
 * Styled with top/bottom fade edges and a scrollbar that appears on overflow,
 * similar to Cursor's thinking/tool-call step display.
 */
function ToolLoopConversation({ logs, depth }: { logs: ToolLoopLog[]; depth: number }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) setIsOverflowing(el.scrollHeight > el.clientHeight);
  }, [logs]);

  const pad = depth > 0 ? `${depth * 12 + 36}px` : '36px';

  return (
    <div className="relative" style={{ paddingLeft: pad, paddingRight: '8px' }}>
      {/* Top fade */}
      {isOverflowing && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 rounded-t-md"
          style={{
            marginLeft: pad,
            marginRight: '8px',
            background: 'linear-gradient(to bottom, var(--background), transparent)',
          }}
        />
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="styled-scrollbar overflow-y-auto rounded-md text-[11px] leading-relaxed"
        style={{ maxHeight: '240px' }}
      >
        <div className="space-y-0.5 py-3">
          {logs.map((log) => (
            <ToolLoopMessage key={log.id} log={log} />
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      {isOverflowing && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 rounded-b-md"
          style={{
            marginLeft: pad,
            marginRight: '8px',
            background: 'linear-gradient(to top, var(--background), transparent)',
          }}
        />
      )}
    </div>
  );
}

/**
 * Collapsible wrapper for a ToolLoop segment (pre-child or post-child).
 * Uses a subtle toggle bar that is visually distinct from the bolder child-node
 * chevrons — thin text, muted colors, dashed left accent when collapsed.
 */
function CollapsibleToolLoopSection({
  logs,
  depth,
  defaultOpen = false,
  sectionToggleSignal,
}: {
  logs: ToolLoopLog[];
  depth: number;
  defaultOpen?: boolean;
  sectionToggleSignal?: SectionToggleSignal;
}) {
  const signalActive = sectionToggleSignal && sectionToggleSignal.gen > 0;
  const [isOpen, setIsOpen] = React.useState(signalActive ? sectionToggleSignal.open : defaultOpen);
  const lastSignalGenRef = React.useRef(sectionToggleSignal?.gen ?? 0);

  React.useEffect(() => {
    if (!sectionToggleSignal) return;
    if (sectionToggleSignal.gen !== lastSignalGenRef.current) {
      lastSignalGenRef.current = sectionToggleSignal.gen;
      setIsOpen(sectionToggleSignal.open);
    }
  }, [sectionToggleSignal]);

  const pad = `${28 + depth * 12}px`;

  return (
    <div className="min-w-0">
      {/* Toggle bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex w-full items-center gap-1 py-0.5 text-[11px]',
          'text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors duration-150'
        )}
        style={{ paddingLeft: pad }}
      >
        <ChevronRight
          className={cn(
            'h-2.5 w-2.5 transition-transform duration-150',
            isOpen && 'rotate-90'
          )}
        />
        <span>{logs.length} {logs.length === 1 ? 'step' : 'steps'}</span>
        {/* Subtle trailing line */}
        <div className="bg-border/30 ml-1.5 h-px flex-1" />
      </button>

      {/* Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <ToolLoopConversation logs={logs} depth={depth} />
      </div>
    </div>
  );
}

/**
 * Loading placeholder with spinner, shown while ToolLoop events are being fetched.
 */
function ToolLoopLoading({ depth }: { depth: number }) {
  return (
    <div
      className="text-muted-foreground/50 flex items-center gap-1.5 py-2 text-[11px]"
      style={{ paddingLeft: `${28 + depth * 12}px` }}
    >
      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      <span>Loading steps…</span>
    </div>
  );
}

export function ActionNodeItem({
  node,
  depth = 0,
  defaultExpanded,
  expandedNodeIds,
  onExpandedChange,
  assistantId,
  getToolLoopEvents,
  sectionToggleSignal,
  className,
}: ActionNodeItemProps) {
  // Determine if we're in controlled mode
  const isControlled = expandedNodeIds !== undefined && onExpandedChange !== undefined;

  // Running nodes are expanded by default
  const initialExpanded = defaultExpanded ?? node.status === 'running';
  const [localIsExpanded, setLocalIsExpanded] = React.useState(initialExpanded);

  // Use controlled state if provided, otherwise use local state
  const isExpanded = isControlled ? expandedNodeIds.has(node.id) : localIsExpanded;

  // Latest LLM thinking content (for running nodes)
  const [latestThinking, setLatestThinking] = React.useState<string | null>(null);

  // Full ToolLoop conversation (lazy-loaded for completed nodes)
  const [completedToolLoopLogs, setCompletedToolLoopLogs] = React.useState<ToolLoopLog[]>([]);
  const [isToolLoopLoading, setIsToolLoopLoading] = React.useState(false);
  const toolLoopFetchedRef = React.useRef(false);

  const hasChildren = node.children && node.children.length > 0;
  const canLoadToolLoop = !!getToolLoopEvents && !!assistantId && node.type === 'manager';
  // Expandable if: has children, OR is running and can show live thinking
  const isExpandable = hasChildren || (node.status === 'running' && canLoadToolLoop);

  // Calculate duration
  const duration = getNodeDuration(node);
  const durationText =
    node.status === 'running' ? `${formatDuration(duration)}...` : formatDuration(duration);

  // Fallback content for non-manager nodes that can't load ToolLoop
  const fallbackContent = React.useMemo(() => {
    if (node.status === 'running') return null;
    const content = node.content;
    if (!content) return null;
    const trimmed = content.trim().toLowerCase();
    if (
      trimmed === 'true' ||
      trimmed === 'false' ||
      trimmed === 'null' ||
      trimmed === 'undefined'
    ) {
      return null;
    }
    return content;
  }, [node.status, node.content]);

  // Handle expand/collapse toggle
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isControlled) {
      onExpandedChange(node.id, !isExpanded);
    } else {
      setLocalIsExpanded(!isExpanded);
    }
  };

  // Fetch latest LLM thinking while node is running
  React.useEffect(() => {
    if (node.status !== 'running' || !canLoadToolLoop) {
      return;
    }

    let isCancelled = false;
    let isCurrentlyLoading = false;

    const fetchLatestThinking = async () => {
      if (isCurrentlyLoading) return;
      isCurrentlyLoading = true;

      try {
        const hierarchyPrefix = node.hierarchy.join('->');
        const response = await getToolLoopEvents(assistantId!, hierarchyPrefix, 5);

        if (isCancelled) return;
        if ('detail' in response) return;

        const logs = (response.logs || []) as ToolLoopLog[];
        for (let i = logs.length - 1; i >= 0; i--) {
          const message = logs[i].entries.message;
          if (message.role === 'system' || message.role === 'user') continue;

          let content: string | undefined;
          if (message.toolCalls && message.toolCalls.length > 0) {
            content = `Calling ${message.toolCalls[0].function.name}...`;
          } else {
            content = extractTextContent(message.content);
          }

          if (content) {
            setLatestThinking(content);
            break;
          }
        }
      } catch {
        // Silently fail
      } finally {
        if (!isCancelled) isCurrentlyLoading = false;
      }
    };

    fetchLatestThinking();
    const interval = setInterval(fetchLatestThinking, 1500);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [node.status, node.hierarchy, canLoadToolLoop, assistantId, getToolLoopEvents]);

  // Load full ToolLoop conversation for completed nodes when expanded.
  // Uses the node's hierarchyLabel (updated from the outgoing event) which
  // carries the same suffix as ToolLoop events, giving an exact scope to
  // this specific invocation without any fragile time filtering.
  React.useEffect(() => {
    if (node.status === 'running' || !canLoadToolLoop || !isExpanded) return;
    if (toolLoopFetchedRef.current) return;
    toolLoopFetchedRef.current = true;

    let isCancelled = false;
    setIsToolLoopLoading(true);

    const load = async () => {
      try {
        const response = await getToolLoopEvents(assistantId!, node.hierarchyLabel, null);
        if (isCancelled || 'detail' in response) return;
        const logs = (response.logs || []) as ToolLoopLog[];
        setCompletedToolLoopLogs(logs.filter((l) => l.entries.message.role !== 'system'));
      } catch {
        // Silently fail
      } finally {
        setIsToolLoopLoading(false);
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [
    node.status,
    isExpanded,
    canLoadToolLoop,
    assistantId,
    getToolLoopEvents,
    node.hierarchyLabel,
  ]);

  // Clear thinking & reset ToolLoop state when node starts running
  React.useEffect(() => {
    if (node.status === 'running') {
      toolLoopFetchedRef.current = false;
      setCompletedToolLoopLogs([]);
      setIsToolLoopLoading(false);
    } else {
      setLatestThinking(null);
    }
  }, [node.status]);

  // Update expansion when status changes (auto-expand running nodes)
  React.useEffect(() => {
    if (node.status === 'running' && !isExpanded) {
      if (isControlled) {
        onExpandedChange(node.id, true);
      } else {
        setLocalIsExpanded(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only trigger on status change
  }, [node.status]);

  // Determine what to render in the detail area.
  const showToolLoopLoading = isExpanded && canLoadToolLoop && isToolLoopLoading;
  const showRunningThinking = isExpanded && node.status === 'running' && !!latestThinking;
  const showFallbackContent = isExpanded && !canLoadToolLoop && !!fallbackContent;
  const hasToolLoopData = completedToolLoopLogs.length > 0;

  // Build a strictly chronological timeline that interleaves ToolLoop segments
  // and children. Each child's startTime is used as a split point so that
  // ToolLoop events before a child render above it, events after render below.
  // This handles any number of children at arbitrary positions in the stream.
  type TimelineSegment =
    | { kind: 'steps'; logs: ToolLoopLog[]; key: string }
    | { kind: 'child'; node: ActionNode };

  const timeline = React.useMemo((): TimelineSegment[] => {
    if (!hasToolLoopData && !hasChildren) return [];

    // No ToolLoop data yet — just list children in order
    if (!hasToolLoopData) {
      return node.children.map((c) => ({ kind: 'child' as const, node: c }));
    }

    // No children — single steps block
    if (!hasChildren) {
      return [{ kind: 'steps' as const, logs: completedToolLoopLogs, key: 'all' }];
    }

    // Interleave: walk through ToolLoop logs and children together,
    // splitting ToolLoop logs at each child's startTime.
    const sortedChildren = [...node.children].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const result: TimelineSegment[] = [];
    let logIdx = 0;

    for (const child of sortedChildren) {
      const childStart = new Date(child.startTime).getTime();
      const segment: ToolLoopLog[] = [];

      while (logIdx < completedToolLoopLogs.length) {
        if (new Date(completedToolLoopLogs[logIdx].ts).getTime() < childStart) {
          segment.push(completedToolLoopLogs[logIdx]);
          logIdx++;
        } else {
          break;
        }
      }

      if (segment.length > 0) {
        result.push({ kind: 'steps', logs: segment, key: `pre-${child.id}` });
      }
      result.push({ kind: 'child', node: child });
    }

    // Remaining logs after the last child
    if (logIdx < completedToolLoopLogs.length) {
      result.push({
        kind: 'steps',
        logs: completedToolLoopLogs.slice(logIdx),
        key: 'post',
      });
    }

    return result;
  }, [hasToolLoopData, hasChildren, completedToolLoopLogs, node.children]);

  // Whether to use the interleaved timeline renderer (ToolLoop data loaded)
  const useTimeline = isExpanded && hasToolLoopData;

  return (
    <div
      data-testid="action-node"
      data-type={node.type}
      data-status={node.status}
      className={cn('min-w-0 select-none', className)}
      style={{ contain: 'inline-size' }}
    >
      {/* Node header */}
      <div
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-sm py-1 pr-1',
          'hover:bg-muted/50 transition-colors duration-150',
          depth > 0 && 'ml-4'
        )}
        style={{ paddingLeft: depth > 0 ? `${depth * 12}px` : undefined }}
      >
        {/* Expand/collapse button */}
        {isExpandable ? (
          <button
            type="button"
            data-testid="expand-button"
            onClick={handleToggle}
            className={cn(
              'flex-shrink-0 rounded p-0.5 hover:bg-muted',
              'text-muted-foreground hover:text-foreground',
              'transition-all duration-150'
            )}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <span className="w-4.5 flex-shrink-0" />
        )}

        {/* Status indicator */}
        <StatusIndicator status={node.status} size="sm" />

        {/* Label — shows displayLabel (human-readable) with raw hierarchy on hover */}
        <span
          className={cn('min-w-0 flex-1 truncate text-sm', getLabelStyles(node.type))}
          title={node.displayLabel ? node.hierarchy[node.hierarchy.length - 1] : undefined}
          style={depth > 0 ? { fontSize: '0.7875rem' } : undefined}
        >
          {node.label}
        </span>

        {/* Duration */}
        <span className="text-caption ml-2 flex-shrink-0 tabular-nums text-muted-foreground">
          {durationText}
        </span>
      </div>

      {/* Running thinking hint — live status indicator */}
      {showRunningThinking && (
        <ContentArea content={latestThinking!} depth={depth} maxHeight={120} />
      )}

      {/* ToolLoop loading spinner */}
      {showToolLoopLoading && <ToolLoopLoading depth={depth} />}

      {/* Interleaved timeline: ToolLoop segments + children in strict chronological order.
          Used once ToolLoop data has loaded for a completed node. */}
      {useTimeline &&
        timeline.map((segment) =>
          segment.kind === 'steps' ? (
            <CollapsibleToolLoopSection
              key={segment.key}
              logs={segment.logs}
              depth={depth}
              sectionToggleSignal={sectionToggleSignal}
            />
          ) : (
            <div key={segment.node.id} className="relative">
              <div
                className="absolute bottom-0 left-[7px] top-0 w-px bg-border"
                style={{ marginLeft: depth > 0 ? `${depth * 12 + 16}px` : '0' }}
              />
              <ActionNodeItem
                node={segment.node}
                depth={depth + 1}
                defaultExpanded={defaultExpanded}
                expandedNodeIds={expandedNodeIds}
                onExpandedChange={onExpandedChange}
                assistantId={assistantId}
                getToolLoopEvents={getToolLoopEvents}
                sectionToggleSignal={sectionToggleSignal}
              />
            </div>
          )
        )}

      {/* Standard children rendering — while running (no ToolLoop yet) or
          for completed nodes without ToolLoop data.
          Hidden during ToolLoop loading to preserve chronological ordering. */}
      {!useTimeline && hasChildren && !showToolLoopLoading && (
        <div
          className={cn(
            'relative overflow-hidden transition-all duration-200 ease-out',
            isExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div
            className="absolute bottom-2 left-[7px] top-0 w-px bg-border"
            style={{ marginLeft: depth > 0 ? `${depth * 12 + 16}px` : '0' }}
          />
          {node.children.map((child) => (
            <ActionNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
              expandedNodeIds={expandedNodeIds}
              onExpandedChange={onExpandedChange}
              assistantId={assistantId}
              getToolLoopEvents={getToolLoopEvents}
              sectionToggleSignal={sectionToggleSignal}
            />
          ))}
        </div>
      )}

      {/* Fallback content for non-manager leaf nodes */}
      {showFallbackContent && (
        <ContentArea content={fallbackContent!} depth={depth} maxHeight={160} />
      )}
    </div>
  );
}
