/**
 * ActionNodeItem - Displays a single action node in the tree.
 *
 * Features:
 * - Shimmer text (ai-elements) for running nodes, red-tinted text for errors, muted text for completed
 * - Hover-only right-side chevrons for expand/collapse
 * - Request text from first ToolLoop user message as the node label
 * - Duration display
 * - Inline content display (latest thinking while running, final answer when complete)
 * - Sleek, borderless scrollable content area
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  Zap,
  SquareTerminal,
  Play,
  Pause,
  Square,
  Bookmark,
  Users,
  FileText,
  BookOpen,
  RefreshCw,
  Repeat,
  ListChecks,
  Cpu,
  KeyRound,
  Wrench,
  MessageSquare,
  Globe,
  MessageCircle,
  CircleDot,
  Loader2,
  Brain,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  ArrowRight,
  ImageIcon,
  Clock,
  Maximize2,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { resolveActionNodePresentation, type ActionNodeKind } from './actionNodePresentation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { dracula, docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import type {
  ActionNode,
  ActionNodeStatus,
  GetToolLoopEventsFn,
  LoadChildrenFn,
  ToolLoopLog,
} from '@/types/assistants/action';
import {
  isToolLoopNoise,
  resolveToolLoopKind,
  extractSteeringTarget,
} from '@/lib/assistants/event-filters';
import { compareLogsByTime } from '@/utils/assistants/assistant-actions';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/UI/tooltip';
const SHOW_EXECUTE_CODE_CONTENT = true;

const CHECK_STATUS_PREFIX = 'check_status_';

function buildResolvedToolCallIds(logs: ToolLoopLog[]): Set<string> {
  const ids = new Set<string>();
  for (const l of logs) {
    const m = l.entries.message as Record<string, unknown>;
    const tcId = (m.toolCallId ?? m.tool_call_id) as string | undefined;
    if (m.role === 'tool' && tcId) {
      ids.add(tcId);
      const name = (m.name as string) ?? '';
      if (name.startsWith(CHECK_STATUS_PREFIX)) {
        ids.add(name.slice(CHECK_STATUS_PREFIX.length));
      }
    }
  }
  return ids;
}

type SteeringEntry = {
  log: ToolLoopLog;
  toolCallName: string;
  toolCallId: string;
};

/**
 * Build a map from target-call-id suffix to the ToolLoop logs that steer it.
 * The suffix is the trailing segment of `stop_execute_code_<suffix>` etc.
 */
function buildSteeringMap(logs: ToolLoopLog[]): Map<string, SteeringEntry[]> {
  const map = new Map<string, SteeringEntry[]>();
  for (const l of logs) {
    const m = l.entries.message as Record<string, unknown>;
    if (m.role !== 'assistant') continue;
    const tcs = (m.toolCalls ?? m.tool_calls) as
      | Array<{
          id: string;
          function: { name: string; arguments: string };
        }>
      | undefined;
    if (!Array.isArray(tcs)) continue;
    for (const tc of tcs) {
      const name = tc.function?.name ?? '';
      const suffix = extractSteeringTarget(name);
      if (!suffix) continue;
      const arr = map.get(suffix) ?? [];
      arr.push({ log: l, toolCallName: name, toolCallId: tc.id });
      map.set(suffix, arr);
    }
  }
  return map;
}

/**
 * Returns the set of log IDs whose *only* tool calls are steering helpers.
 * These logs are rendered as sub-rows of their target rather than standalone.
 */
function buildSteeringLogIds(logs: ToolLoopLog[]): Set<number> {
  const ids = new Set<number>();
  for (const l of logs) {
    const m = l.entries.message as Record<string, unknown>;
    if (m.role !== 'assistant') continue;
    const tcs = (m.toolCalls ?? m.tool_calls) as
      | Array<{
          function: { name: string };
        }>
      | undefined;
    if (!Array.isArray(tcs) || tcs.length === 0) continue;
    if (tcs.every((tc) => extractSteeringTarget(tc.function?.name ?? '') !== null)) {
      ids.add(l.id);
    }
  }
  return ids;
}

/**
 * Rewrite check_status tool RESULTS so they appear as normal results for the
 * original tool call.  The check_status assistant message (the synthetic call)
 * is left untouched — isToolLoopNoise still filters it from display.
 */
function rewriteCheckStatusResults(logs: ToolLoopLog[]): ToolLoopLog[] {
  const toolNameByCallId = new Map<string, string>();
  for (const l of logs) {
    const m = l.entries.message;
    const tcs = m.toolCalls ?? ((m as Record<string, unknown>).tool_calls as typeof m.toolCalls);
    if (m.role === 'assistant' && Array.isArray(tcs)) {
      for (const tc of tcs) {
        const tcId = tc.id as string | undefined;
        const tcName = (tc.function?.name ?? (tc as Record<string, unknown>).name) as
          | string
          | undefined;
        if (tcId && tcName) toolNameByCallId.set(tcId, tcName);
      }
    }
  }

  return logs.map((l) => {
    const m = l.entries.message;
    if (m.role !== 'tool') return l;
    const name: string = m.name ?? '';
    if (!name.startsWith(CHECK_STATUS_PREFIX)) return l;

    const originalCallId = name.slice(CHECK_STATUS_PREFIX.length);
    const originalToolName = toolNameByCallId.get(originalCallId) ?? originalCallId;

    return {
      ...l,
      entries: {
        ...l.entries,
        kind: 'tool_result',
        message: {
          ...m,
          ['tool_call_id']: originalCallId,
          toolCallId: originalCallId,
          name: originalToolName,
        },
      },
    };
  });
}

// ---------------------------------------------------------------------------
// SSE ↔ polled dedup: SSE events may carry synthetic IDs (negative, or 0)
// that differ from the database row IDs in polled data. Build a fingerprint
// from backend-stable fields so the merge can identify duplicates.
// ---------------------------------------------------------------------------

function makeLogFingerprint(l: ToolLoopLog): string {
  const ts = l.entries.eventTimestamp || l.ts;
  const kind = l.entries.kind || '';
  const role = l.entries.message?.role || '';
  const raw = l.entries.message?.content;
  const slice =
    typeof raw === 'string'
      ? raw.slice(0, 80)
      : Array.isArray(raw) && raw.length > 0
        ? (raw[0]?.text || '').slice(0, 80)
        : '';
  return `${kind}|${role}|${ts}|${slice}`;
}

function deduplicateLiveLogs(polled: ToolLoopLog[], live: ToolLoopLog[]): ToolLoopLog[] {
  if (polled.length === 0) return live;
  if (live.length === 0) return polled;

  const polledIds = new Set(polled.map((l) => l.id));
  const polledEventIds = new Set(polled.map((l) => l.entries.eventId).filter(Boolean));
  const polledFingerprints = new Set(polled.map(makeLogFingerprint));

  const extra = live.filter((l) => {
    if (polledIds.has(l.id)) return false;
    if (l.entries.eventId && polledEventIds.has(l.entries.eventId)) return false;
    if (polledFingerprints.has(makeLogFingerprint(l))) return false;
    return true;
  });

  if (extra.length === 0) return polled;
  return [...polled, ...extra].sort(compareLogsByTime);
}

// ---------------------------------------------------------------------------
// Drag-to-resize hook + handle for scrollable regions
// ---------------------------------------------------------------------------

function useResizableHeight(defaultHeight: number, minHeight = 40) {
  const [height, setHeight] = React.useState(defaultHeight);
  const heightRef = React.useRef(height);
  heightRef.current = height;

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startH = heightRef.current;

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault();
        setHeight(Math.max(minHeight, startH + (ev.clientY - startY)));
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [minHeight]
  );

  return { height, onPointerDown } as const;
}

function ResizeHandle({
  onPointerDown,
  paddingLeft,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  paddingLeft?: string;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="group/resize z-20 flex h-1 cursor-row-resize touch-none select-none items-center"
      style={paddingLeft ? { paddingLeft } : undefined}
    >
      <div
        className="group-hover/resize:bg-muted-foreground/25 group-active/resize:bg-muted-foreground/40 h-px w-full rounded-full transition-colors"
        style={{ background: 'hsl(0 0% 100% / 0.08)' }}
      />
    </div>
  );
}

interface BracketGeom {
  topY: number;
  midYs: number[];
  bottomY: number;
  barX: number;
  lineWidth: number;
  /** True when the result hasn't arrived yet (open bracket, no bottom bar). */
  pending?: boolean;
}

function BracketLines({ geom }: { geom: BracketGeom }) {
  const bg = 'var(--border)';
  const top = geom.topY - 1;
  const bot = geom.bottomY - 1;
  return (
    <>
      {/* top horizontal */}
      <div
        className="pointer-events-none"
        style={{
          position: 'absolute',
          top,
          left: geom.barX,
          width: geom.lineWidth,
          height: 1,
          background: bg,
        }}
      />
      {/* vertical — inset by 1px at each end to avoid corner overlap */}
      <div
        className="pointer-events-none"
        style={{
          position: 'absolute',
          top: top + 1,
          left: geom.barX,
          width: 1,
          height: bot - top - (geom.pending ? 0 : 1),
          background: bg,
        }}
      />
      {/* middle horizontal bars (nest rows) — start 1px right to avoid overlap with the vertical */}
      {geom.midYs.map((midY, i) => (
        <div
          key={i}
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: midY - 1,
            left: geom.barX + 1,
            width: geom.lineWidth - 1,
            height: 1,
            background: bg,
          }}
        />
      ))}
      {/* bottom horizontal — omitted for pending (open) brackets */}
      {!geom.pending && (
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: bot,
            left: geom.barX,
            width: geom.lineWidth,
            height: 1,
            background: bg,
          }}
        />
      )}
    </>
  );
}

function findIconCenter(
  rowEl: HTMLElement,
  containerRect: DOMRect
): { x: number; y: number } | null {
  const svg = rowEl.querySelector<SVGElement>('svg');
  if (svg) {
    const r = svg.getBoundingClientRect();
    return {
      x: r.left - containerRect.left + r.width / 2,
      y: r.top - containerRect.top + r.height / 2,
    };
  }
  return null;
}

function computeBracketGeom(container: HTMLElement, hoveredTcId: string): BracketGeom | null {
  const callEl = container.querySelector<HTMLElement>(
    `[data-tc-id="${CSS.escape(hoveredTcId)}"][data-tc-role="call"]`
  );
  if (!callEl) return null;

  const resultEl = container.querySelector<HTMLElement>(
    `[data-tc-id="${CSS.escape(hoveredTcId)}"][data-tc-role="result"]`
  );

  const containerRect = container.getBoundingClientRect();
  const callIcon = findIconCenter(callEl, containerRect);
  if (!callIcon) return null;

  const topY = callIcon.y;
  const iconLeftEdge = callIcon.x - 7;
  const barX = iconLeftEdge - 6;
  const lineWidth = iconLeftEdge - barX;

  const nestEls = container.querySelectorAll<HTMLElement>(
    `[data-tc-id="${CSS.escape(hoveredTcId)}"][data-tc-role="nest"]`
  );

  if (resultEl) {
    const resultIcon = findIconCenter(resultEl, containerRect);
    if (!resultIcon) return null;

    // Check for tail elements (e.g. image rows) that extend below the result
    const tailEls = container.querySelectorAll<HTMLElement>(
      `[data-tc-id="${CSS.escape(hoveredTcId)}"][data-tc-role="tail"]`
    );
    let bottomY = resultIcon.y;
    const midYs: number[] = [];

    if (tailEls.length > 0) {
      // Result becomes a midpoint; tail is the new bottom
      midYs.push(resultIcon.y);
      tailEls.forEach((el) => {
        const center = findIconCenter(el, containerRect);
        if (center && center.y > resultIcon.y) bottomY = Math.max(bottomY, center.y);
      });
    }

    if (topY >= bottomY) return null;

    nestEls.forEach((el) => {
      const center = findIconCenter(el, containerRect);
      if (center && center.y > topY && center.y < bottomY) midYs.push(center.y);
    });
    midYs.sort((a, b) => a - b);

    return { topY, midYs, bottomY, barX, lineWidth };
  }

  // Pending: no result yet — anchor bracket at the last nest element
  const midYs: number[] = [];
  nestEls.forEach((el) => {
    const center = findIconCenter(el, containerRect);
    if (center && center.y > topY) midYs.push(center.y);
  });
  if (midYs.length === 0) return null;
  midYs.sort((a, b) => a - b);

  const bottomY = midYs[midYs.length - 1];
  return { topY, midYs, bottomY, barX, lineWidth, pending: true };
}

/** Signal object for expand/collapse all to reach CollapsibleToolLoopSection. */
export type SectionToggleSignal = { open: boolean; gen: number };

export interface ActionNodeItemProps {
  /** The action node to display */
  node: ActionNode;
  /** Owner user ID for constructing context paths */
  ownerId?: string;
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
  /** Function to lazy-load child events for a node on expand */
  loadChildren?: LoadChildrenFn;
  /** Signal to force-expand/collapse all ToolLoop step sections */
  sectionToggleSignal?: SectionToggleSignal;
  /** IDs of nodes that directly matched the current search */
  matchedIds?: Set<string>;
  /** Current search term for text highlighting */
  searchTerm?: string;
  /** Stop an in-flight root action (calling_id) */
  onStopAction?: (callingId: string) => void;
  /** Blow this root action up into the focus overlay (calling_id) */
  onFocusAction?: (callingId: string) => void;
  /** Open this root action in a new browser tab (calling_id) */
  onOpenActionInNewTab?: (callingId: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Get label styling based on node status.
 */
function getLabelStyles(status: ActionNodeStatus): string {
  if (status === 'error') return 'text-error font-medium';
  if (status === 'running') return 'text-foreground font-medium shimmer';
  if (status === 'awaiting') return 'text-muted-foreground font-medium';
  return 'text-foreground font-medium';
}

const NODE_KIND_STYLES: Record<ActionNodeKind, { bg: string; fg: string }> = {
  request: { bg: 'var(--status-success-bg)', fg: 'var(--status-success)' },
  note: { bg: 'var(--status-warning-bg)', fg: 'var(--status-warning)' },
  question: { bg: 'var(--status-info-bg)', fg: 'var(--status-info)' },
  default: { bg: 'var(--muted)', fg: 'var(--muted-foreground)' },
};

const NodeIconBox = React.forwardRef<
  HTMLButtonElement,
  {
    kind: ActionNodeKind;
    icon: LucideIcon;
    status: ActionNodeStatus;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }
>(function NodeIconBox({ kind, icon: Icon, status, onClick, className, ...props }, ref) {
  const tone = NODE_KIND_STYLES[kind];
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg border border-transparent',
        status === 'running' && 'ring-2 ring-primary-tint-25',
        className
      )}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'icon-shimmer')} />
    </button>
  );
});
NodeIconBox.displayName = 'NodeIconBox';

/**
 * Parse a timestamp string, ensuring UTC interpretation.
 */
function parseTs(ts: string): Date {
  return new Date(ts.endsWith('Z') || ts.includes('+') || ts.includes('-', 10) ? ts : ts + 'Z');
}

/**
 * Format a timestamp string to local 24-hour time with seconds.
 */
function formatEventTime(ts: string): string {
  return parseTs(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Root rows omit the date — date sub-headings carry that context. */
function formatRootEventTime(ts: string): string {
  return formatEventTime(ts);
}

/**
 * Format a millisecond duration to a compact human-readable string.
 * Gracefully escalates: ms → s → m → h → d.
 */
function formatCompactDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = sec / 60;
  if (min < 60) return `${min.toFixed(1)}m`;
  const hrs = min / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  const days = hrs / 24;
  return `${days.toFixed(1)}d`;
}

/**
 * Create a synthetic ToolLoopLog that wraps a child ActionNode so it can
 * be rendered inline among regular ToolLoop messages.
 */
function makeSyntheticLog(child: ActionNode, toolCallId: string | null): ToolLoopLog {
  return {
    id: hashStringToInt(child.id),
    ts: child.startTime,
    entries: {
      message: { role: 'system', content: child.displayLabel || child.label },
      method: '',
      hierarchy: child.hierarchy,
      hierarchyLabel: child.hierarchyLabel,
      eventTimestamp: child.startTime,
    },
    syntheticChildNode: child,
    syntheticToolCallId: toolCallId,
  };
}

function hashStringToInt(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return hash < 0 ? -hash : hash;
}

/**
 * Collect liveToolLoopLogs from a node and all its descendants.
 * Mirrors the Orchestra getToolLoopEvents prefix query behaviour so that
 * PubSub-only rendering (where each node only has its own exact-hierarchy
 * live logs) can display the full descendant conversation inline.
 */
function collectDescendantLiveLogs(node: ActionNode): ToolLoopLog[] {
  const logs: ToolLoopLog[] = [...(node.liveToolLoopLogs ?? [])];
  for (const child of node.children) {
    logs.push(...collectDescendantLiveLogs(child));
  }
  return logs;
}

function countDescendantLiveLogs(node: ActionNode): number {
  let count = node.liveToolLoopLogs?.length ?? 0;
  for (const child of node.children) {
    count += countDescendantLiveLogs(child);
  }
  return count;
}

function isNodeOrDescendantRunning(node: ActionNode): boolean {
  if (node.status === 'running') return true;
  return node.children.some(isNodeOrDescendantRunning);
}

/**
 * Scan backwards through already-placed logs to find the tool_call_id of
 * the tool call that spawned this child node.
 *
 * Two strategies, tried in order:
 *
 * 1. **Boundary-segment matching** — the hierarchy entry immediately after
 *    the parent's hierarchy encodes the spawning tool (e.g.
 *    "execute_function(primitives.web.ask)(xx)").  Matches when the segment
 *    starts with the tool call name or contains its function_name argument.
 *
 * 2. **Pending-call fallback** — when the child shares the parent's lineage
 *    directly (e.g. inner primitives called from execute_code), there's no
 *    distinguishing boundary segment.  In that case, attribute the child to
 *    the most recent tool call that hasn't received its result yet — the
 *    in-flight call that must have spawned it.
 */
function findSpawningToolCallId(
  precedingLogs: ToolLoopLog[],
  child: ActionNode,
  parentHierarchyLen: number
): string | null {
  // Strategy 1: boundary-segment name matching
  const boundarySeg = child.hierarchy[parentHierarchyLen] || '';
  if (boundarySeg) {
    for (let i = precedingLogs.length - 1; i >= 0; i--) {
      const msg = precedingLogs[i].entries.message;
      if (msg.role !== 'assistant' || !msg.toolCalls) continue;
      for (const tc of msg.toolCalls) {
        if (boundarySeg.startsWith(tc.function.name)) return tc.id;
        try {
          const args = JSON.parse(tc.function.arguments);
          if (args.function_name && boundarySeg.includes(args.function_name)) return tc.id;
        } catch {
          /* skip */
        }
      }
    }
  }

  // Strategy 2: attribute to the most recent pending (unresolved) tool call
  const resolvedIds = new Set<string>();
  for (const log of precedingLogs) {
    const m = log.entries.message as Record<string, unknown>;
    const tcId = (m.toolCallId ?? m.tool_call_id) as string | undefined;
    if (m.role === 'tool' && tcId) resolvedIds.add(tcId);
  }
  for (let i = precedingLogs.length - 1; i >= 0; i--) {
    const msg = precedingLogs[i].entries.message;
    if (msg.role !== 'assistant' || !msg.toolCalls) continue;
    for (const tc of msg.toolCalls) {
      if (!resolvedIds.has(tc.id)) return tc.id;
    }
  }

  return null;
}

/**
 * Live-ticking duration badge. Ticks every second while running,
 * shows static duration when completed/errored.
 */
function LiveDuration({ node, variant = 'tag' }: { node: ActionNode; variant?: 'tag' | 'inline' }) {
  const [now, setNow] = React.useState(Date.now);

  React.useEffect(() => {
    if (node.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [node.status]);

  const startMs = node.startTime ? new Date(node.startTime).getTime() : 0;
  if (!startMs) return null;

  const endMs =
    node.status === 'running' ? now : node.endTime ? new Date(node.endTime).getTime() : startMs;
  const elapsed = Math.max(0, endMs - startMs);
  const label = formatCompactDuration(elapsed);

  if (variant === 'inline') {
    return (
      <span className="text-muted-foreground/40 ml-1.5 shrink-0 text-[10px] tabular-nums">
        · {label}
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-md border border-border bg-muted px-[7px] py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
      {label}
    </span>
  );
}

/**
 * Extract text content from various formats.
 */
function extractTextContent(
  content: string | Array<{ type: string; text?: string }> | undefined
): string | null {
  if (!content) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    let imgIdx = 0;
    const redacted = content.map((block) => {
      if ((block.type === 'image_url' || block.type === 'imageUrl') && block) {
        const raw = block as Record<string, unknown>;
        const urlObj = (raw.imageUrl ?? raw.image_url) as { url: string } | undefined;
        if (urlObj?.url) {
          const label = `image${imgIdx}`;
          imgIdx++;
          const redactedBlock = { ...block, imageUrl: { url: label } };
          delete (redactedBlock as Record<string, unknown>)['image_url'];
          return redactedBlock;
        }
      }
      return block;
    });
    return JSON.stringify(redacted, null, 2);
  }
  return null;
}

/**
 * Extract image data URLs from content block arrays.
 */
function extractImageUrls(
  content: string | Array<{ type: string; imageUrl?: { url: string } }> | undefined
): string[] {
  if (!content || typeof content === 'string' || !Array.isArray(content)) return [];
  return content
    .filter((block) => block.type === 'image_url' || block.type === 'imageUrl')
    .map((block) => {
      const raw = block as Record<string, unknown>;
      const urlObj = (raw.imageUrl ?? raw.image_url) as { url: string } | undefined;
      return urlObj?.url ?? '';
    })
    .filter(Boolean);
}

/**
 * Detects if a string is likely JSON (object or array).
 */
function isLikelyJson(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  return (
    (trimmed[0] === '{' && trimmed[trimmed.length - 1] === '}') ||
    (trimmed[0] === '[' && trimmed[trimmed.length - 1] === ']')
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const markdownComponents = {
  p: ({ children }: any) => <p className="my-0.5 whitespace-pre-wrap break-words">{children}</p>,
  pre: ({ children }: any) => (
    <pre className="bg-muted/50 my-1 whitespace-pre-wrap break-words rounded px-2 py-1.5 text-[10px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children, ...props }: any) => (
    <code className="bg-muted/50 rounded px-1 py-0.5 text-[10px]" {...props}>
      {children}
    </code>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--status-info)] underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }: any) => <ul className="my-0.5 list-disc pl-4">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-0.5 list-decimal pl-4">{children}</ol>,
  li: ({ children }: any) => <li className="my-0">{children}</li>,
  h1: ({ children }: any) => <strong className="block text-xs">{children}</strong>,
  h2: ({ children }: any) => <strong className="block text-xs">{children}</strong>,
  h3: ({ children }: any) => <strong className="block text-[11px]">{children}</strong>,
  table: ({ children }: any) => (
    <div className="my-1 overflow-x-auto">
      <table className="border-muted/30 border-collapse border text-[10px]">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="bg-muted/30 border-muted/30 border px-1.5 py-0.5 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }: any) => <td className="border-muted/30 border px-1.5 py-0.5">{children}</td>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-muted-foreground/20 my-0.5 border-l-2 pl-2 italic">
      {children}
    </blockquote>
  ),
};
/* eslint-disable @typescript-eslint/no-explicit-any */
const inlineMarkdownComponents = {
  p: ({ children }: any) => <span>{children} </span>,
  pre: ({ children }: any) => <span className="font-mono text-[10px]">{children} </span>,
  code: ({ children, ...props }: any) => (
    <code className="bg-muted/50 rounded px-0.5 text-[10px]" {...props}>
      {children}
    </code>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--status-info)] underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }: any) => <span>{children} </span>,
  ol: ({ children }: any) => <span>{children} </span>,
  li: ({ children }: any) => <span>{children}; </span>,
  h1: ({ children }: any) => <strong>{children} </strong>,
  h2: ({ children }: any) => <strong>{children} </strong>,
  h3: ({ children }: any) => <strong>{children} </strong>,
  table: ({ children }: any) => <span>{children} </span>,
  th: ({ children }: any) => <span className="font-medium">{children} </span>,
  td: ({ children }: any) => <span>{children} </span>,
  tr: ({ children }: any) => <span>{children} </span>,
  thead: ({ children }: any) => <span>{children} </span>,
  tbody: ({ children }: any) => <span>{children} </span>,
  blockquote: ({ children }: any) => <span className="italic">{children} </span>,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const remarkPlugins = [remarkGfm];

/**
 * Expand escaped \n inside JSON string values into real newlines with
 * aligned indentation so multi-line content (prompts, markdown, code)
 * reads naturally. All other JSON escapes pass through unchanged.
 */
function expandStringNewlines(jsonText: string): string {
  const out: string[] = [];
  let i = 0;
  const n = jsonText.length;
  let inString = false;
  let indent = 0;

  while (i < n) {
    const ch = jsonText[i];

    if (!inString) {
      out.push(ch);
      if (ch === '"') {
        inString = true;
        const lastNl = jsonText.lastIndexOf('\n', i - 1);
        indent = i - lastNl;
      }
      i++;
      continue;
    }

    if (ch === '\\' && i + 1 < n) {
      const nxt = jsonText[i + 1];
      if (nxt === 'n') {
        out.push('\n', ' '.repeat(indent));
        i += 2;
        continue;
      }
      out.push(ch, nxt);
      i += 2;
      continue;
    }

    out.push(ch);
    if (ch === '"') inString = false;
    i++;
  }

  return out.join('');
}

const FENCED_CODE_RE = /([ \t]*```(\w+))\n([\s\S]*?)\n([ \t]*```)(?!\w)/g;

type JsonSegment =
  | { kind: 'text'; text: string }
  | { kind: 'code'; lang: string; code: string; opener: string; closer: string };

/**
 * Split text into alternating plain-text and fenced-code-block segments.
 * Code blocks keep their original indentation so they align visually
 * with the surrounding JSON structure.
 */
function splitCodeBlocks(text: string): JsonSegment[] {
  const segments: JsonSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(FENCED_CODE_RE.source, FENCED_CODE_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, start) });
    }
    segments.push({
      kind: 'code',
      lang: match[2],
      code: match[3],
      opener: match[1],
      closer: match[4],
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Renders content as formatted markdown or pretty-printed JSON.
 * Auto-detects JSON objects/arrays and formats them with newline
 * expansion and syntax highlighting for fenced code blocks;
 * everything else goes through react-markdown with GFM support.
 */
function RichContent({ content }: { content: string }) {
  const { theme } = useTheme();

  if (isLikelyJson(content)) {
    try {
      const formatted = expandStringNewlines(JSON.stringify(JSON.parse(content), null, 2));
      const segments = splitCodeBlocks(formatted);
      const hasCodeBlocks = segments.some((s) => s.kind === 'code');

      if (!hasCodeBlocks) {
        return (
          <pre className="bg-muted/50 whitespace-pre-wrap break-words rounded px-2 py-1.5 text-[10px] leading-relaxed">
            <code>{formatted}</code>
          </pre>
        );
      }

      const hlStyle = theme && ['dark', 'system'].includes(theme) ? dracula : docco;

      return (
        <pre className="bg-muted/50 whitespace-pre-wrap break-words rounded px-2 py-1.5 text-[10px] leading-relaxed">
          {segments.map((seg, i) =>
            seg.kind === 'text' ? (
              <code key={i}>{seg.text}</code>
            ) : (
              <code key={i}>
                {seg.opener}
                {'\n'}
                <SyntaxHighlighter
                  language={seg.lang}
                  style={hlStyle}
                  PreTag="span"
                  customStyle={{
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    display: 'inline',
                  }}
                >
                  {seg.code}
                </SyntaxHighlighter>
                {'\n'}
                {seg.closer}
              </code>
            )
          )}
        </pre>
      );
    } catch {
      /* not valid JSON, fall through to markdown */
    }
  }

  return (
    <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
      {content}
    </Markdown>
  );
}

/**
 * Renders markdown inline (no block elements) for single-line truncated display.
 * Falls back to plain text for JSON content.
 */
function TruncatedMarkdown({ content }: { content: string }) {
  if (isLikelyJson(content)) return <span>{content}</span>;
  return (
    <Markdown remarkPlugins={remarkPlugins} components={inlineMarkdownComponents}>
      {content}
    </Markdown>
  );
}

/**
 * Wraps substrings matching `term` in a styled <mark> for search highlighting.
 * Case-insensitive. Returns the original text unchanged when `term` is empty.
 */
function HighlightText({ text, term }: { text: string; term?: string }) {
  if (!term || term.trim() === '') return <>{text}</>;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-accent text-accent-foreground">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/**
 * Scrollable content area with sleek styling and fade effect.
 */
function ContentArea({
  content,
  depth,
  maxHeight: defaultMaxHeight = 80,
}: {
  content: string;
  depth: number;
  maxHeight?: number;
}) {
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const { height: maxH, onPointerDown } = useResizableHeight(defaultMaxHeight);

  React.useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setIsOverflowing(el.scrollHeight > el.clientHeight);
    }
  }, [content, maxH]);

  return (
    <div
      className="relative min-w-0"
      style={{
        paddingLeft: `${20 + depth * 8}px`,
        maxWidth: `calc(100% - ${depth * 8 + 8}px)`,
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          'overflow-y-auto text-[12px] leading-relaxed text-muted-foreground',
          'scrollbar-none hover:scrollbar-thin hover:scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/20'
        )}
        style={{
          maxHeight: `${maxH}px`,
          scrollbarWidth: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.style.scrollbarWidth as unknown) = 'thin';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.scrollbarWidth as unknown) = 'none';
        }}
      >
        <RichContent content={content} />
      </div>

      {isOverflowing && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-4"
          style={{
            paddingLeft: `${20 + depth * 8}px`,
            background: 'linear-gradient(to bottom, transparent, var(--background))',
          }}
        />
      )}

      <ResizeHandle onPointerDown={onPointerDown} />
    </div>
  );
}

const STEERING_ICON_MAP: Record<string, { Icon: LucideIcon; color: string }> = {
  stop: { Icon: Square, color: 'text-[color:var(--status-danger)]' },
  pause: { Icon: Pause, color: 'text-[color:var(--status-warning)]' },
  resume: { Icon: Play, color: 'text-[color:var(--role-teal)]' },
  interject: { Icon: CornerDownLeft, color: 'text-[color:var(--role-purple)]' },
};

function SteeringSubRow({
  entry,
  resolvedToolCallIds,
  nodeCompleted,
}: {
  entry: SteeringEntry;
  resolvedToolCallIds?: Set<string>;
  nodeCompleted?: boolean;
}) {
  const prefix = entry.toolCallName.split('_')[0].toLowerCase();
  const style = STEERING_ICON_MAP[prefix] ?? {
    Icon: Zap,
    color: 'text-[color:var(--status-warning)]',
  };
  const pending = resolvedToolCallIds
    ? !nodeCompleted && !resolvedToolCallIds.has(entry.toolCallId)
    : false;
  const time = formatEventTime(entry.log.entries.eventTimestamp || entry.log.ts);

  let label: string;
  try {
    const msg = entry.log.entries.message as Record<string, unknown>;
    const tcs = (msg.toolCalls ?? msg.tool_calls) as
      | Array<{ id: string; function: { arguments: string } }>
      | undefined;
    const argsJson = tcs?.find((tc) => tc.id === entry.toolCallId)?.function.arguments ?? '{}';
    const args = JSON.parse(argsJson);
    const reason = args.reason as string | undefined;
    label = reason ? `${prefix} — ${reason}` : prefix;
  } catch {
    label = prefix;
  }

  return (
    <div className="flex items-center gap-2 pl-4">
      <span className={cn('shrink-0', style.color)}>
        <style.Icon className="h-2.5 w-2.5" />
      </span>
      <span className={cn('min-w-0 truncate', style.color, pending && 'shimmer')}>{label}</span>
      <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
        {time}
      </span>
    </div>
  );
}

/**
 * Look up steering entries that target a given tool call ID.
 */
function getSteeringForToolCall(
  toolCallId: string,
  steeringMap?: Map<string, SteeringEntry[]>
): SteeringEntry[] {
  if (!steeringMap || steeringMap.size === 0) return [];
  let result: SteeringEntry[] = [];
  steeringMap.forEach((entries, suffix) => {
    if (toolCallId.endsWith(suffix)) result = entries;
  });
  return result;
}

/**
 * A single tool-call row that expands to show the full JSON arguments on click.
 */
function ToolCallRow({
  entry,
  time,
  actionIcon,
  isPending,
  searchTerm,
  onTcHover,
  hoveredTcId,
  onLayoutChange,
}: {
  entry: { label: string; toolCallId: string; arguments: string };
  time: string;
  actionIcon: React.ReactNode;
  isPending?: boolean;
  searchTerm?: string;
  onTcHover?: (tcId: string | null) => void;
  hoveredTcId?: string | null;
  onLayoutChange?: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  let formattedArgs: string | null = null;
  try {
    const parsed = JSON.parse(entry.arguments);
    if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      formattedArgs = expandStringNewlines(JSON.stringify(parsed, null, 2));
    }
  } catch {
    /* not valid JSON */
  }

  const canExpand = !!formattedArgs;
  const isHighlighted = hoveredTcId === entry.toolCallId;
  const tcRowRef = React.useRef<HTMLDivElement>(null);

  const handleTcRowClick = () => {
    if (!isOpen && canExpand) {
      setIsOpen(true);
      onLayoutChange?.();
    } else if (!isOpen && !canExpand) {
      const el = tcRowRef.current;
      if (el) {
        el.classList.remove('animate-nudge');
        void el.offsetWidth;
        el.classList.add('animate-nudge');
      }
    }
  };

  return (
    <div
      ref={tcRowRef}
      className={cn(
        'group cursor-pointer rounded-sm transition-colors duration-150',
        !isOpen && canExpand && 'hover:bg-muted/40',
        isHighlighted && 'bg-muted/40'
      )}
      data-tc-id={entry.toolCallId}
      data-tc-role="call"
      onClick={handleTcRowClick}
      onMouseEnter={() => onTcHover?.(entry.toolCallId)}
      onMouseLeave={() => onTcHover?.(null)}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          isOpen && 'hover:bg-muted/40 cursor-pointer rounded-sm'
        )}
        onClick={
          isOpen
            ? () => {
                setIsOpen(false);
                onLayoutChange?.();
              }
            : undefined
        }
      >
        {actionIcon}
        <span className={cn('min-w-0 truncate text-muted-foreground', isPending && 'shimmer')}>
          <HighlightText text={entry.label} term={searchTerm} />
          {!isOpen && formattedArgs && (
            <span className="text-muted-foreground/40">
              {' '}
              {formattedArgs.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ')}
            </span>
          )}
        </span>
        {canExpand && (
          <ChevronRight
            className={cn(
              'text-muted-foreground/40 h-2.5 w-2.5 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100',
              isOpen && 'rotate-90'
            )}
          />
        )}
        <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
          {time}
        </span>
      </div>
      {isOpen && formattedArgs && (
        <pre
          className="hover:bg-muted/40 cursor-pointer whitespace-pre-wrap break-words rounded-sm pl-[18px] text-[10px] leading-relaxed text-muted-foreground"
          onClick={() => {
            setIsOpen(false);
            onLayoutChange?.();
          }}
        >
          {formattedArgs}
        </pre>
      )}
    </div>
  );
}

function InlineImageGallery({ urls }: { urls: string[] }) {
  const [lightboxIdx, setLightboxIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (lightboxIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIdx]);

  return (
    <>
      <div className="flex flex-wrap gap-2 py-1 pl-[18px]">
        {urls.map((url, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`image${i}`}
                className="border-border/30 max-h-48 max-w-full cursor-pointer rounded border object-contain"
                onClick={() => setLightboxIdx(i)}
              />
            </TooltipTrigger>
            <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
              image{i}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay-strong)]"
          onClick={() => setLightboxIdx(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[lightboxIdx]}
            alt={`image${lightboxIdx}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={() => setLightboxIdx(null)}
          />
        </div>
      )}
    </>
  );
}

function ImageResultRow({
  urls,
  time,
  tcId,
  onTcHover,
}: {
  urls: string[];
  time: string;
  tcId?: string;
  onTcHover?: (tcId: string | null) => void;
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div
        ref={rowRef}
        className="hover:bg-muted/40 group flex cursor-pointer items-start gap-2 rounded-sm transition-colors duration-150"
        onClick={() => setIsOpen(!isOpen)}
        {...(tcId
          ? {
              'data-tc-id': tcId,
              'data-tc-role': 'tail',
              onMouseEnter: () => onTcHover?.(tcId),
              onMouseLeave: () => onTcHover?.(null),
            }
          : {})}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="mt-0.5 shrink-0 text-[color:var(--status-info)]">
              <ImageIcon className="h-2.5 w-2.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
            images
          </TooltipContent>
        </Tooltip>
        <span className="min-w-0 truncate text-muted-foreground">
          {urls.length} image{urls.length !== 1 ? 's' : ''}
        </span>
        <ChevronRight
          className={cn(
            'text-muted-foreground/40 mt-0.5 h-2.5 w-2.5 shrink-0 transition-all duration-150',
            isOpen ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        />
        {!isOpen && (
          <span className="text-muted-foreground/30 ml-auto shrink-0 pl-1 text-[10px] tabular-nums">
            {time}
          </span>
        )}
      </div>
      {isOpen && <InlineImageGallery urls={urls} />}
    </>
  );
}

function ThoughtLabel({ text, time }: { text: string; time: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="flex cursor-pointer items-start gap-2"
      onClick={() => {
        const el = ref.current;
        if (el) {
          el.classList.remove('animate-nudge');
          void el.offsetWidth;
          el.classList.add('animate-nudge');
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            <Brain className="h-2.5 w-2.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
          thought
        </TooltipContent>
      </Tooltip>
      <span className="min-w-0 break-words text-muted-foreground">{text}</span>
      <span className="text-muted-foreground/30 ml-auto shrink-0 pl-1 text-[10px] tabular-nums">
        {time}
      </span>
    </div>
  );
}

function InlineContentRow({
  content: text,
  time,
  Icon,
  iconColor,
  tooltipLabel,
}: {
  content: string;
  time: string;
  Icon: LucideIcon;
  iconColor: string;
  tooltipLabel: string;
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth || text.includes('\n'));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  const collapsedPreview = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');

  const handleClick = () => {
    if (!isOpen && isTruncated) {
      setIsOpen(true);
    } else if (isOpen) {
      setIsOpen(false);
    } else {
      const el = rowRef.current;
      if (el) {
        el.classList.remove('animate-nudge');
        void el.offsetWidth;
        el.classList.add('animate-nudge');
      }
    }
  };

  const firstLine = text.split(/\n/)[0];
  const rest = text.split(/\n/).slice(1).join('\n').trim();

  return (
    <>
      <div
        ref={rowRef}
        className={cn(
          'group flex cursor-pointer items-start gap-2 rounded-sm transition-colors duration-150',
          !isOpen && isTruncated && 'hover:bg-muted/40',
          isOpen && 'hover:bg-muted/40'
        )}
        onClick={handleClick}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('mt-0.5 shrink-0', iconColor)}>
              <Icon className="h-2.5 w-2.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
            {tooltipLabel}
          </TooltipContent>
        </Tooltip>
        <span
          ref={contentRef}
          className={cn('min-w-0 text-muted-foreground', isOpen ? 'break-words' : 'truncate')}
        >
          {isOpen ? firstLine : collapsedPreview}
        </span>
        {!isOpen && isTruncated && (
          <ChevronRight className="text-muted-foreground/40 mt-0.5 h-2.5 w-2.5 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100" />
        )}
        {!isOpen && (
          <span className="text-muted-foreground/30 ml-auto shrink-0 pl-1 text-[10px] tabular-nums">
            {time}
          </span>
        )}
      </div>
      {isOpen && rest && (
        <div
          className="hover:bg-muted/40 cursor-pointer rounded-sm pl-[18px] text-[12px] leading-relaxed text-muted-foreground"
          onClick={() => setIsOpen(false)}
        >
          <RichContent content={rest} />
        </div>
      )}
    </>
  );
}

/**
 * Renders a single ToolLoop message with a role tag, content, and right-justified timestamp.
 * When log._actionNode is set, renders an inline child node row instead.
 */
function ToolLoopMessage({
  log,
  isLatestLog,
  nodeCompleted,
  resolvedToolCallIds,
  steeringMap,
  searchTerm,
  onTcHover,
  hoveredTcId,
  onLayoutChange,
  ownerId,
  assistantId,
  getToolLoopEvents,
  suppressTrailingResponse,
}: {
  log: ToolLoopLog;
  isLatestLog?: boolean;
  nodeCompleted?: boolean;
  /** Tool call IDs that already have a matching result in the logs. */
  resolvedToolCallIds?: Set<string>;
  /** Map from target-call-id suffix to steering log entries that target it. */
  steeringMap?: Map<string, SteeringEntry[]>;
  searchTerm?: string;
  onTcHover?: (tcId: string | null) => void;
  hoveredTcId?: string | null;
  onLayoutChange?: () => void;
  ownerId?: string;
  assistantId?: string;
  getToolLoopEvents?: GetToolLoopEventsFn;
  suppressTrailingResponse?: boolean;
}) {
  const { message } = log.entries;
  const time = formatEventTime(log.entries.eventTimestamp || log.ts);
  const { theme: themeVal } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCodeOpen, setIsCodeOpen] = React.useState(false);
  const collapsedContentRef = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const msg = message as Record<string, unknown>;
  const textContent = extractTextContent(message.content);
  const imageUrls = extractImageUrls(message.content as Parameters<typeof extractImageUrls>[0]);
  const [childLogs, setChildLogs] = React.useState<ToolLoopLog[]>([]);
  const [childLoading, setChildLoading] = React.useState(false);
  const childFetchedRef = React.useRef(false);
  const steeringRef = React.useRef<HTMLDivElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);

  // Hooks for inline child node expansion — must be unconditional (rules of hooks).
  const child = log.syntheticChildNode;
  const childRunning = child ? isNodeOrDescendantRunning(child) : false;
  const [childLogsOpen, setChildLogsOpen] = React.useState(childRunning);

  React.useEffect(() => {
    if (childRunning && !childLogsOpen) {
      setChildLogsOpen(true);
      onLayoutChange?.();
    }
  }, [childRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect live logs from the child AND all its descendants. This mirrors
  // the Orchestra getToolLoopEvents prefix query so PubSub-only streaming
  // shows the full descendant conversation inline.
  const descendantLiveLogCount = child ? countDescendantLiveLogs(child) : 0;

  const filteredChildLiveLogs = React.useMemo(() => {
    if (!child || descendantLiveLogCount === 0) return [];
    const allLogs = collectDescendantLiveLogs(child);
    const rewritten = rewriteCheckStatusResults(allLogs);
    return rewritten.filter((l) => !isToolLoopNoise(l.entries)).sort(compareLogsByTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- descendantLiveLogCount is a primitive proxy for deep liveToolLoopLogs mutations
  }, [child, descendantLiveLogCount]);

  const effectiveChildLogs = React.useMemo(
    () => deduplicateLiveLogs(childLogs, filteredChildLiveLogs),
    [childLogs, filteredChildLiveLogs]
  );

  const childResolvedToolCallIds = React.useMemo(
    () => {
      const logsForResolution =
        childLogs.length > 0 ? childLogs : child ? collectDescendantLiveLogs(child) : [];
      return buildResolvedToolCallIds(logsForResolution);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- descendantLiveLogCount is a primitive proxy
    [childLogs, descendantLiveLogCount]
  );

  React.useEffect(() => {
    const el = collapsedContentRef.current;
    if (!el) return;
    const check = () => {
      const elText = el.textContent || '';
      setIsTruncated(elText.includes('\n') || el.scrollWidth > el.clientWidth);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [textContent, isOpen]);

  // Inline child node — renders as a one-liner that expands to show its own ToolLoop
  if (child) {
    const tcId = log.syntheticToolCallId ?? null;
    const isHighlighted = tcId != null && hoveredTcId === tcId;
    const innerChild =
      child.children.length === 1 && child.children[0].displayLabel ? child.children[0] : null;
    const childLabel = innerChild?.displayLabel ?? child.displayLabel ?? child.label;
    const childTime = formatEventTime(child.startTime);
    const canExpand = !!(getToolLoopEvents && ownerId && assistantId) || descendantLiveLogCount > 0;

    const handleChildToggle = () => {
      if (!canExpand) return;
      const opening = !childLogsOpen;
      setChildLogsOpen(opening);
      onLayoutChange?.();

      if (opening && !childFetchedRef.current && getToolLoopEvents && assistantId && ownerId) {
        childFetchedRef.current = true;
        setChildLoading(true);
        getToolLoopEvents(
          ownerId,
          assistantId,
          child.hierarchy,
          null,
          child.startTime || undefined,
          child.endTime || undefined
        )
          .then((response) => {
            if ('detail' in response) return;
            const logs = (response.logs || []) as ToolLoopLog[];
            const rewritten = rewriteCheckStatusResults(logs);
            setChildLogs(rewritten.filter((l) => !isToolLoopNoise(l.entries)));
            requestAnimationFrame(() => onLayoutChange?.());
          })
          .catch(() => {})
          .finally(() => setChildLoading(false));
      }
    };

    return (
      <div
        className={cn(
          'group rounded-sm transition-colors duration-150',
          canExpand && !childLogsOpen && 'hover:bg-muted/40 cursor-pointer',
          isHighlighted && 'bg-muted/40'
        )}
        data-tc-id={tcId ?? undefined}
        data-tc-role="nest"
        onMouseEnter={tcId ? () => onTcHover?.(tcId) : undefined}
        onMouseLeave={tcId ? () => onTcHover?.(null) : undefined}
      >
        <div
          className={cn(
            'flex items-center gap-2',
            childLogsOpen && canExpand && 'hover:bg-muted/40 cursor-pointer rounded-sm'
          )}
          onClick={canExpand ? handleChildToggle : undefined}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 text-primary-tint-70">
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
              nested action
            </TooltipContent>
          </Tooltip>
          <span
            className={cn(
              'min-w-0 truncate text-muted-foreground',
              isNodeOrDescendantRunning(child) && 'shimmer'
            )}
          >
            {childLabel}
          </span>
          {canExpand && (
            <ChevronRight
              className={cn(
                'text-muted-foreground/40 h-2.5 w-2.5 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100',
                childLogsOpen && 'rotate-90'
              )}
            />
          )}
          <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
            {childTime}
          </span>
        </div>
        {childLogsOpen && childLoading && effectiveChildLogs.length === 0 && (
          <div className="text-muted-foreground/40 flex items-center gap-1.5 py-1 text-[11px]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading...</span>
          </div>
        )}
        {childLogsOpen && effectiveChildLogs.length > 0 && (
          <div>
            <ToolLoopConversation
              logs={effectiveChildLogs}
              depth={0}
              searchTerm={searchTerm}
              ownerId={ownerId}
              assistantId={assistantId}
              getToolLoopEvents={getToolLoopEvents}
              nested
              onLayoutChange={onLayoutChange}
              resolvedToolCallIds={childResolvedToolCallIds}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Kind-based style map ───────────────────────────────────────────────
  /* eslint-disable @typescript-eslint/naming-convention */
  const KIND_STYLES: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
    request: { label: 'request', color: 'text-[color:var(--status-info)]', Icon: ArrowDown },
    interjection: {
      label: 'interjection',
      color: 'text-[color:var(--status-info)]',
      Icon: ArrowDown,
    },
    thinking_sentinel: {
      label: 'thought',
      color: 'text-muted-foreground',
      Icon: Brain,
    },
    thought: { label: 'thought', color: 'text-muted-foreground', Icon: Brain },
    tool_call: {
      label: 'action',
      color: 'text-[color:var(--status-warning)]',
      Icon: Zap,
    },
    response: {
      label: 'response',
      color: 'text-[color:var(--status-success)]',
      Icon: ArrowUp,
    },
    tool_result: {
      label: 'result',
      color: 'text-[color:var(--role-purple)]',
      Icon: CornerDownLeft,
    },
    steering_pause: {
      label: 'Pause',
      color: 'text-[color:var(--status-warning)]',
      Icon: Pause,
    },
    steering_resume: {
      label: 'Resume',
      color: 'text-[color:var(--role-teal)]',
      Icon: Play,
    },
    steering_stop: {
      label: 'Stop',
      color: 'text-[color:var(--status-danger)]',
      Icon: Square,
    },
    steering_helper: {
      label: 'dispatch',
      color: 'text-[color:var(--status-warning)]',
      Icon: Zap,
    },
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  const kind = resolveToolLoopKind(log.entries);
  const kindStyle = KIND_STYLES[kind];
  if (!kindStyle) return null;

  // ── Steering events — always one-liners, not collapsible ──────────────
  if (kind === 'steering_pause' || kind === 'steering_resume' || kind === 'steering_stop') {
    const displayText = textContent || kindStyle.label;
    return (
      <div
        ref={steeringRef}
        className="flex cursor-pointer items-center gap-2"
        onClick={() => {
          const el = steeringRef.current;
          if (el) {
            el.classList.remove('animate-nudge');
            void el.offsetWidth;
            el.classList.add('animate-nudge');
          }
        }}
      >
        <span className={cn('shrink-0', kindStyle.color)}>
          <kindStyle.Icon className="h-2.5 w-2.5" />
        </span>
        <span className={cn('min-w-0 truncate', kindStyle.color)}>{displayText}</span>
        <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
          {time}
        </span>
      </div>
    );
  }

  // ── Thinking sentinel — animated "Thinking" display ───────────────────
  if (kind === 'thinking_sentinel') {
    if (!isLatestLog || nodeCompleted) return null;
    return (
      <div className="flex items-start gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              <Brain className="h-2.5 w-2.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
            thought
          </TooltipContent>
        </Tooltip>
        <span className="shimmer truncate text-muted-foreground">Thinking</span>
        <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
          {time}
        </span>
      </div>
    );
  }

  // ── Tool call rendering (shared by tool_call, steering_helper, thought w/ calls) ──
  const renderCallLine = () => {
    if (!message.toolCalls || message.toolCalls.length === 0) return null;
    const rawAliases = log.entries.toolAliases;
    const normalizeKey = (k: string) => k.replace(/_/g, '').toLowerCase();
    const aliases = rawAliases
      ? Object.fromEntries(Object.entries(rawAliases).map(([k, v]) => [normalizeKey(k), v]))
      : null;

    const codeBlocks: Array<{ lang: string; code: string; toolCallId: string }> = [];
    if (SHOW_EXECUTE_CODE_CONTENT) {
      for (const tc of message.toolCalls) {
        if (tc.function.name !== 'execute_code') continue;
        try {
          const args = JSON.parse(tc.function.arguments);
          if (args.code)
            codeBlocks.push({
              lang: args.language || 'python',
              code: args.code,
              toolCallId: tc.id,
            });
        } catch {
          /* skip malformed arguments */
        }
      }
    }

    const notificationMessages: string[] = [];
    const toolEntries = message.toolCalls
      .map((tc) => {
        if (codeBlocks.length > 0 && tc.function.name === 'execute_code') return null;
        if (tc.function.name === 'send_notification') {
          try {
            const args = JSON.parse(tc.function.arguments);
            if (args.message) notificationMessages.push(args.message);
          } catch {
            /* skip */
          }
          return null;
        }
        const alias = aliases?.[normalizeKey(tc.function.name)];
        return {
          label: alias || `${tc.function.name}()`,
          toolCallId: tc.id,
          arguments: tc.function.arguments,
        };
      })
      .filter(Boolean) as Array<{ label: string; toolCallId: string; arguments: string }>;

    const actionIcon = (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 text-[color:var(--status-warning)]">
            <Zap className="h-2.5 w-2.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
          action
        </TooltipContent>
      </Tooltip>
    );

    const rows: React.ReactNode[] = [];

    for (let i = 0; i < notificationMessages.length; i++) {
      rows.push(
        <InlineContentRow
          key={`notif-${i}`}
          content={notificationMessages[i]}
          time={time}
          Icon={ArrowUp}
          iconColor="text-[color:var(--status-success)]"
          tooltipLabel="notification"
        />
      );
    }

    for (let i = 0; i < toolEntries.length; i++) {
      const entry = toolEntries[i];
      const pending =
        !nodeCompleted &&
        (resolvedToolCallIds ? !resolvedToolCallIds.has(entry.toolCallId) : false);
      const steeringEntries = getSteeringForToolCall(entry.toolCallId, steeringMap);
      rows.push(
        <React.Fragment key={`tool-${i}`}>
          <ToolCallRow
            entry={entry}
            time={time}
            actionIcon={actionIcon}
            isPending={pending}
            searchTerm={searchTerm}
            onTcHover={onTcHover}
            hoveredTcId={hoveredTcId}
            onLayoutChange={onLayoutChange}
          />
          {steeringEntries.map((se, si) => (
            <SteeringSubRow
              key={`steer-${i}-${si}`}
              entry={se}
              resolvedToolCallIds={resolvedToolCallIds}
              nodeCompleted={nodeCompleted}
            />
          ))}
        </React.Fragment>
      );
    }

    if (codeBlocks.length > 0) {
      const hlStyle = themeVal && ['dark', 'system'].includes(themeVal) ? dracula : docco;

      rows.push(
        <div
          key="code"
          className={cn(
            'group rounded-sm transition-colors duration-150',
            isCodeOpen ? '' : 'hover:bg-muted/40 cursor-pointer',
            hoveredTcId && hoveredTcId === codeBlocks[0].toolCallId && 'bg-muted/40'
          )}
          onClick={
            !isCodeOpen
              ? () => {
                  setIsCodeOpen(true);
                  onLayoutChange?.();
                }
              : undefined
          }
          data-tc-id={codeBlocks[0].toolCallId}
          data-tc-role="call"
          onMouseEnter={() => onTcHover?.(codeBlocks[0].toolCallId)}
          onMouseLeave={() => onTcHover?.(null)}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              isCodeOpen && 'hover:bg-muted/40 cursor-pointer rounded-sm'
            )}
            onClick={
              isCodeOpen
                ? () => {
                    setIsCodeOpen(false);
                    onLayoutChange?.();
                  }
                : undefined
            }
          >
            {actionIcon}
            <span
              className={cn(
                'min-w-0 truncate text-muted-foreground',
                !nodeCompleted &&
                  resolvedToolCallIds &&
                  !resolvedToolCallIds.has(codeBlocks[0].toolCallId) &&
                  'shimmer'
              )}
            >
              Run code
              {!isCodeOpen && (
                <span className="text-muted-foreground/40">
                  {' ```'}
                  {codeBlocks[0].code
                    .replace(/\n+/g, ' ')
                    .replace(/\s{2,}/g, ' ')
                    .trim()}
                  {'```'}
                </span>
              )}
            </span>
            <ChevronRight
              className={cn(
                'text-muted-foreground/40 h-2.5 w-2.5 shrink-0 self-center opacity-0 transition-all duration-150 group-hover:opacity-100',
                isCodeOpen && 'rotate-90'
              )}
            />
            <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
              {time}
            </span>
          </div>
          {isCodeOpen &&
            codeBlocks.map((block, i) => (
              <div
                key={i}
                className="hover:bg-muted/40 cursor-pointer rounded-sm"
                onClick={() => {
                  setIsCodeOpen(false);
                  onLayoutChange?.();
                }}
              >
                <SyntaxHighlighter
                  language={block.lang}
                  style={hlStyle}
                  wrapLongLines
                  customStyle={{
                    fontSize: '10px',
                    lineHeight: '1.4',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    margin: '4px 0 2px 18px',
                    overflowX: 'hidden',
                    width: 'fit-content',
                    maxWidth: 'calc(100% - 18px)',
                  }}
                >
                  {block.code.trim()}
                </SyntaxHighlighter>
              </div>
            ))}
        </div>
      );

      const codeSteeringEntries = getSteeringForToolCall(codeBlocks[0].toolCallId, steeringMap);
      for (let si = 0; si < codeSteeringEntries.length; si++) {
        rows.push(
          <SteeringSubRow
            key={`code-steer-${si}`}
            entry={codeSteeringEntries[si]}
            resolvedToolCallIds={resolvedToolCallIds}
          />
        );
      }
    }

    if (rows.length === 0) return null;
    return rows.length === 1 ? rows[0] : <>{rows}</>;
  };

  // ── Pure tool calls (no text content) — render as call rows ───────────
  if ((kind === 'tool_call' || kind === 'steering_helper') && !textContent) {
    const isWaitOnly =
      message.toolCalls?.length === 1 &&
      (message.toolCalls[0].function.name === 'wait' ||
        ((message.toolCalls[0] as Record<string, unknown>).name as string) === 'wait');
    if (isWaitOnly) {
      return <ThoughtLabel text="Waiting..." time={time} />;
    }
    const callLines = renderCallLine();
    if (!callLines) return null;
    return (
      <>
        <ThoughtLabel text="Selecting actions." time={time} />
        {callLines}
      </>
    );
  }

  // ── Content-based kinds — label + icon + color from the style map ─────
  let label: string = kindStyle.label;
  let color: string = kindStyle.color;
  let LabelIcon: LucideIcon = kindStyle.Icon;
  let content: string | null = null;
  let trailingCallLine: React.ReactNode = null;
  let trailingResponseContent: string | null = null;
  let leadingThoughtLabel: string | null = null;

  if (kind === 'thought') {
    const blocks =
      msg.thinkingBlocks ??
      msg.thinking_blocks ??
      (msg.providerSpecificFields as Record<string, unknown> | undefined)?.thinkingBlocks ??
      (msg.provider_specific_fields as Record<string, unknown> | undefined)?.thinking_blocks;
    let thinkingText: string | null = null;
    if (Array.isArray(blocks)) {
      thinkingText = blocks
        .map((b: Record<string, unknown>) => (b.thinking as string) || '')
        .filter(Boolean)
        .join('\n\n');
    }
    if (!thinkingText) {
      const rc = (msg.reasoningContent ?? msg.reasoning_content) as string | undefined;
      if (rc) thinkingText = rc;
    }
    content = thinkingText || textContent;
    if (message.toolCalls?.length) trailingCallLine = renderCallLine();
    else if (
      !suppressTrailingResponse &&
      thinkingText &&
      textContent &&
      textContent.replace(/^\s+/, '')
    ) {
      trailingResponseContent = textContent.replace(/^\s+/, '');
    }
  } else if (kind === 'tool_call') {
    label = 'thought';
    color = 'text-muted-foreground';
    LabelIcon = Brain;
    content = textContent;
    trailingCallLine = renderCallLine();
  } else if (kind === 'response') {
    leadingThoughtLabel = 'Sending response.';
    content = textContent;
  } else {
    content = textContent;
  }

  if (!content && imageUrls.length === 0) return null;
  if (content) content = content.replace(/^\s+/, '');
  if (!content && imageUrls.length === 0) return null;

  const collapsedPreview = content ? content.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ') : '';
  const firstLine = content ? content.split(/\n/)[0] : '';
  const isJson = content ? isLikelyJson(content) : false;
  const jsonExpandable =
    isJson &&
    (() => {
      try {
        return JSON.stringify(JSON.parse(content!), null, 2).includes('\n');
      } catch {
        return false;
      }
    })();
  const hasMoreLines = content ? content.includes('\n') : false;
  const canExpand = isTruncated || hasMoreLines || jsonExpandable;

  const tcResultId =
    message.role === 'tool'
      ? (message.toolCallId ??
        ((msg as Record<string, unknown>).tool_call_id as string | undefined))
      : undefined;

  const handleRowClick = () => {
    if (!isOpen && canExpand) {
      setIsOpen(true);
      onLayoutChange?.();
    } else if (!isOpen && !canExpand) {
      const el = rowRef.current;
      if (el) {
        el.classList.remove('animate-nudge');
        void el.offsetWidth;
        el.classList.add('animate-nudge');
      }
    }
  };

  if (!content && imageUrls.length > 0) {
    return <ImageResultRow urls={imageUrls} time={time} tcId={tcResultId} onTcHover={onTcHover} />;
  }

  return (
    <>
      {leadingThoughtLabel && <ThoughtLabel text={leadingThoughtLabel} time={time} />}
      <div
        ref={rowRef}
        className={cn(
          'group cursor-pointer rounded-sm transition-colors duration-150',
          !isOpen && canExpand && 'hover:bg-muted/40',
          tcResultId && hoveredTcId && hoveredTcId === tcResultId && 'bg-muted/40'
        )}
        onClick={handleRowClick}
        {...(tcResultId
          ? {
              'data-tc-id': tcResultId,
              'data-tc-role': 'result',
              onMouseEnter: () => onTcHover?.(tcResultId),
              onMouseLeave: () => onTcHover?.(null),
            }
          : {})}
      >
        <div
          className={cn(
            'flex items-start gap-2',
            isOpen && 'hover:bg-muted/40 cursor-pointer rounded-sm'
          )}
          onClick={
            isOpen
              ? () => {
                  setIsOpen(false);
                  onLayoutChange?.();
                }
              : undefined
          }
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('mt-0.5 shrink-0', color)}>
                <LabelIcon className="h-2.5 w-2.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
          {!isOpen && (
            <span ref={collapsedContentRef} className="min-w-0 truncate text-muted-foreground">
              <TruncatedMarkdown content={collapsedPreview} />
            </span>
          )}
          {isOpen && (
            <span
              className={cn('min-w-0 text-muted-foreground', isJson ? 'truncate' : 'break-words')}
            >
              {isJson ? content!.trim()[0] : <TruncatedMarkdown content={firstLine} />}
            </span>
          )}
          {!isOpen && canExpand && (
            <ChevronRight className="text-muted-foreground/40 mt-0.5 h-2.5 w-2.5 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100" />
          )}
          {!isOpen && (
            <span className="text-muted-foreground/30 ml-auto shrink-0 pl-1 text-[10px] tabular-nums">
              {time}
            </span>
          )}
        </div>
        {isOpen &&
          (() => {
            if (isJson) {
              try {
                const lines = JSON.stringify(JSON.parse(content!), null, 2).split('\n');
                return (
                  <pre
                    className="hover:bg-muted/40 cursor-pointer whitespace-pre-wrap break-words rounded-sm pl-[18px] text-[10px] leading-relaxed text-muted-foreground"
                    onClick={() => {
                      setIsOpen(false);
                      onLayoutChange?.();
                    }}
                  >
                    {lines.slice(1).join('\n')}
                  </pre>
                );
              } catch {
                return null;
              }
            }
            const rest = content!.split(/\n/).slice(1).join('\n').trim();
            if (!rest) return null;
            return (
              <div
                className="hover:bg-muted/40 cursor-pointer rounded-sm pl-[18px] text-[12px] leading-relaxed text-muted-foreground"
                onClick={() => {
                  setIsOpen(false);
                  onLayoutChange?.();
                }}
              >
                <RichContent content={rest} />
              </div>
            );
          })()}
      </div>
      {imageUrls.length > 0 && (
        <ImageResultRow urls={imageUrls} time={time} tcId={tcResultId} onTcHover={onTcHover} />
      )}
      {trailingCallLine}
      {trailingResponseContent && (
        <InlineContentRow
          content={trailingResponseContent}
          time={time}
          Icon={ArrowUp}
          iconColor="text-[color:var(--status-success)]"
          tooltipLabel="response"
        />
      )}
    </>
  );
}

/**
 * Displays the full ToolLoop conversation for a completed node.
 * Styled with top/bottom fade edges and a scrollbar that appears on overflow,
 * similar to Cursor's thinking/tool-call step display.
 */
function ToolLoopConversation({
  logs,
  depth,
  nodeCompleted,
  searchTerm,
  ownerId,
  assistantId,
  getToolLoopEvents,
  nested,
  onLayoutChange: parentLayoutChange,
  resolvedToolCallIds: resolvedToolCallIdsProp,
  suppressTrailingContentIds,
}: {
  logs: ToolLoopLog[];
  depth: number;
  nodeCompleted?: boolean;
  searchTerm?: string;
  ownerId?: string;
  assistantId?: string;
  getToolLoopEvents?: GetToolLoopEventsFn;
  nested?: boolean;
  onLayoutChange?: () => void;
  resolvedToolCallIds?: Set<string>;
  suppressTrailingContentIds?: Set<number>;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [hoveredTcId, setHoveredTcId] = React.useState<string | null>(null);
  const [bracketGeom, setBracketGeom] = React.useState<BracketGeom | null>(null);
  const [layoutGen, setLayoutGen] = React.useState(0);
  const { height: maxH, onPointerDown } = useResizableHeight(240);
  const signalLayoutChange = React.useCallback(() => {
    setLayoutGen((n) => n + 1);
    parentLayoutChange?.();
  }, [parentLayoutChange]);

  const localResolvedIds = React.useMemo(() => buildResolvedToolCallIds(logs), [logs]);
  const resolvedToolCallIds = resolvedToolCallIdsProp ?? localResolvedIds;

  const steeringMap = React.useMemo(() => buildSteeringMap(logs), [logs]);
  const steeringLogIds = React.useMemo(() => buildSteeringLogIds(logs), [logs]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight);
  }, [logs, maxH]);

  // Scroll to bottom on mount so the most recent events are visible first
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!hoveredTcId || !contentRef.current) {
      setBracketGeom(null);
      return;
    }
    requestAnimationFrame(() => {
      if (contentRef.current) {
        setBracketGeom(computeBracketGeom(contentRef.current, hoveredTcId));
      }
    });
  }, [hoveredTcId, layoutGen, logs.length]);

  const pad = depth > 0 ? `${depth * 8 + 26}px` : '26px';

  return (
    <div className="relative">
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

      <div
        ref={scrollRef}
        className="styled-scrollbar overflow-y-auto rounded-md text-[11px] leading-relaxed"
        style={{ maxHeight: `${maxH}px`, paddingLeft: pad, paddingRight: nested ? 0 : '4px' }}
      >
        <div ref={contentRef} className={cn('relative space-y-0.5', nested ? 'pt-1' : 'py-3')}>
          {logs
            .filter((l) => !steeringLogIds.has(l.id))
            .map((log, idx, filtered) => (
              <ToolLoopMessage
                key={log.id}
                log={log}
                isLatestLog={idx === filtered.length - 1}
                nodeCompleted={nodeCompleted}
                resolvedToolCallIds={resolvedToolCallIds}
                steeringMap={steeringMap}
                searchTerm={searchTerm}
                onTcHover={setHoveredTcId}
                hoveredTcId={hoveredTcId}
                onLayoutChange={signalLayoutChange}
                ownerId={ownerId}
                assistantId={assistantId}
                getToolLoopEvents={getToolLoopEvents}
                suppressTrailingResponse={suppressTrailingContentIds?.has(log.id)}
              />
            ))}
          {bracketGeom && <BracketLines geom={bracketGeom} />}
        </div>
      </div>

      <ResizeHandle onPointerDown={onPointerDown} paddingLeft={pad} />
    </div>
  );
}

/**
 * Live ToolLoop timeline for running nodes.
 * Auto-scrolls to the bottom as new events arrive unless the user
 * has manually scrolled up to inspect older events.
 */
function LiveToolLoopTimeline({
  logs,
  depth,
  searchTerm,
  ownerId,
  assistantId,
  getToolLoopEvents,
  resolvedToolCallIds: resolvedToolCallIdsProp,
  suppressTrailingContentIds,
}: {
  logs: ToolLoopLog[];
  depth: number;
  searchTerm?: string;
  ownerId?: string;
  assistantId?: string;
  getToolLoopEvents?: GetToolLoopEventsFn;
  resolvedToolCallIds?: Set<string>;
  suppressTrailingContentIds?: Set<number>;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = React.useRef(false);
  const prevLogCountRef = React.useRef(0);
  const [hoveredTcId, setHoveredTcId] = React.useState<string | null>(null);
  const [bracketGeom, setBracketGeom] = React.useState<BracketGeom | null>(null);
  const [layoutGen, setLayoutGen] = React.useState(0);
  const { height: maxH, onPointerDown } = useResizableHeight(260);
  const signalLayoutChange = React.useCallback(() => setLayoutGen((n) => n + 1), []);

  const localResolvedIds = React.useMemo(() => buildResolvedToolCallIds(logs), [logs]);
  const resolvedToolCallIds = resolvedToolCallIdsProp ?? localResolvedIds;

  const steeringMap = React.useMemo(() => buildSteeringMap(logs), [logs]);
  const steeringLogIds = React.useMemo(() => buildSteeringLogIds(logs), [logs]);

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distFromBottom > 40;
  }, []);

  React.useEffect(() => {
    if (logs.length > prevLogCountRef.current && !isUserScrolledUpRef.current) {
      const el = scrollRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
    prevLogCountRef.current = logs.length;
  }, [logs.length]);

  // Also scroll when inner content grows (e.g. expanded child ToolLoop
  // events streaming in). logs.length only changes for direct entries;
  // this catches height growth from nested child expansions.
  React.useEffect(() => {
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!content || !scroll) return;
    const ro = new ResizeObserver(() => {
      if (isUserScrolledUpRef.current) return;
      requestAnimationFrame(() => {
        scroll.scrollTop = scroll.scrollHeight;
      });
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!hoveredTcId || !contentRef.current) {
      setBracketGeom(null);
      return;
    }
    requestAnimationFrame(() => {
      if (contentRef.current) {
        setBracketGeom(computeBracketGeom(contentRef.current, hoveredTcId));
      }
    });
  }, [hoveredTcId, layoutGen, logs.length]);

  const pad = depth > 0 ? `${depth * 8 + 26}px` : '26px';

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="styled-scrollbar overflow-y-auto rounded-md text-[11px] leading-relaxed"
        style={{ maxHeight: `${maxH}px`, paddingLeft: pad, paddingRight: '4px' }}
      >
        <div ref={contentRef} className="relative space-y-0.5 py-2">
          {logs
            .filter((l) => !steeringLogIds.has(l.id))
            .map((log, idx, filtered) => (
              <ToolLoopMessage
                key={log.id}
                log={log}
                isLatestLog={idx === filtered.length - 1}
                resolvedToolCallIds={resolvedToolCallIds}
                steeringMap={steeringMap}
                searchTerm={searchTerm}
                onTcHover={setHoveredTcId}
                hoveredTcId={hoveredTcId}
                onLayoutChange={signalLayoutChange}
                ownerId={ownerId}
                assistantId={assistantId}
                getToolLoopEvents={getToolLoopEvents}
                suppressTrailingResponse={suppressTrailingContentIds?.has(log.id)}
              />
            ))}
          {bracketGeom && <BracketLines geom={bracketGeom} />}
        </div>
      </div>

      <ResizeHandle onPointerDown={onPointerDown} paddingLeft={pad} />
    </div>
  );
}

/**
 * Status pill shown on the right of a root action row (Done / Failed /
 * Running), matching the design's per-request status chips.
 */
function RootStatusPill({ status }: { status: ActionNode['status'] }) {
  const cfg =
    status === 'running'
      ? {
          label: 'Running',
          cls: 'border border-primary-tint-50 bg-primary-tint-10 text-primary',
          dot: true,
        }
      : status === 'awaiting'
        ? {
            label: 'Waiting for input',
            cls: 'border border-border bg-muted text-muted-foreground',
            dot: false,
          }
        : status === 'error'
          ? {
              label: 'Failed',
              cls: 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger)]',
              dot: false,
            }
          : {
              label: 'Done',
              cls: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]',
              dot: false,
            };
  return (
    <span
      data-testid="action-root-status-pill"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-[9px] py-0.5 text-[11px] font-semibold capitalize',
        cfg.cls
      )}
    >
      {cfg.dot && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      )}
      {cfg.label}
    </span>
  );
}

/**
 * Window control in a root action's header row. Stops propagation so the
 * surrounding header's expand/collapse toggle doesn't also fire.
 */
function RootHeaderIconButton({
  label,
  testId,
  onClick,
  children,
}: {
  label: string;
  testId: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground',
        'transition-colors hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Prominent display for request/response content pulled out of the collapsed
 * step sections. Matches the faded/scrollable style of ContentArea.
 */
function PromotedContent({
  icon: Icon,
  label,
  labelColor,
  content,
  depth,
  defaultOpen = false,
  timestamp,
  searchTerm,
  calloutTone,
}: {
  icon?: LucideIcon;
  label: string;
  labelColor: string;
  content: string;
  depth: number;
  defaultOpen?: boolean;
  timestamp?: string;
  searchTerm?: string;
  /** When set, render as a tinted "callout" box (e.g. the final response). */
  calloutTone?: 'success' | 'error';
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const inlineRef = React.useRef<HTMLSpanElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const pad = `${20 + depth * 8}px`;
  const toneSolid = calloutTone === 'error' ? 'var(--status-danger)' : 'var(--status-success)';
  const toneBg = calloutTone === 'error' ? 'var(--status-danger-bg)' : 'var(--status-success-bg)';

  const trimmedContent = content.replace(/^\s+/, '');
  const hasMoreLines = trimmedContent.includes('\n');
  const canExpand = isTruncated || hasMoreLines;

  React.useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    const check = () => {
      const elText = el.textContent || '';
      setIsTruncated(elText.includes('\n') || el.scrollWidth > el.clientWidth);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content, isOpen]);

  const handleClick = () => {
    if (!isOpen && canExpand) {
      setIsOpen(true);
    } else if (!isOpen) {
      const el = rowRef.current;
      if (el) {
        el.classList.remove('animate-nudge');
        void el.offsetWidth;
        el.classList.add('animate-nudge');
      }
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div
      className={cn(
        'group min-w-0 transition-colors duration-150',
        calloutTone ? 'mb-2 mt-2' : 'rounded-sm'
      )}
      style={calloutTone ? { marginLeft: pad } : { paddingLeft: pad }}
    >
      {calloutTone && (
        <div className="mb-1 flex items-center gap-2 pr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em]"
                style={{ color: toneSolid }}
              >
                {Icon && <Icon className="h-2.5 w-2.5" />}
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
          {timestamp && (
            <span className="text-muted-foreground/70 ml-auto shrink-0 font-mono text-[10px] tabular-nums">
              {timestamp}
            </span>
          )}
        </div>
      )}

      <div
        className={cn(calloutTone && 'rounded-lg border px-3 py-2.5', !calloutTone && 'rounded-sm')}
        style={calloutTone ? { backgroundColor: toneBg, borderColor: toneSolid } : undefined}
      >
        <div
          ref={rowRef}
          className={cn(
            'flex cursor-pointer items-start gap-1 rounded-sm py-0.5 pr-1 text-[12px]',
            !calloutTone && 'hover:bg-muted/40'
          )}
          onClick={handleClick}
        >
          {!calloutTone && Icon && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('mt-[3px] shrink-0', labelColor)}>
                  <Icon className="h-2.5 w-2.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" size="sm" className="px-2 py-1 text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          )}
          {!calloutTone && !Icon && (
            <span className={cn('shrink-0 font-medium', labelColor)}>{label}</span>
          )}
          {!isOpen && (
            <span ref={inlineRef} className="min-w-0 truncate text-muted-foreground">
              {searchTerm ? (
                <HighlightText
                  text={trimmedContent.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ')}
                  term={searchTerm}
                />
              ) : (
                <TruncatedMarkdown
                  content={trimmedContent.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ')}
                />
              )}
            </span>
          )}
          {isOpen && (
            <span ref={inlineRef} className="min-w-0 break-words text-muted-foreground">
              {searchTerm ? (
                <HighlightText text={trimmedContent.split(/\n/)[0]} term={searchTerm} />
              ) : (
                <TruncatedMarkdown content={trimmedContent.split(/\n/)[0]} />
              )}
            </span>
          )}
          {!isOpen && canExpand && (
            <ChevronRight className="text-muted-foreground/40 h-2.5 w-2.5 shrink-0 self-center opacity-0 transition-all duration-150 group-hover:opacity-100" />
          )}
          {!isOpen && !calloutTone && timestamp && (
            <span className="text-muted-foreground/70 ml-auto shrink-0 pl-2 font-mono text-[10px] tabular-nums">
              {timestamp}
            </span>
          )}
        </div>
        {isOpen &&
          (() => {
            const rest = trimmedContent.split(/\n/).slice(1).join('\n').trim();
            if (!rest) return null;
            return (
              <div
                className="text-[11px] leading-relaxed text-muted-foreground"
                style={{ maxWidth: `calc(100% - 8px)` }}
              >
                {searchTerm ? (
                  <HighlightText text={rest} term={searchTerm} />
                ) : (
                  <RichContent content={rest} />
                )}
              </div>
            );
          })()}
      </div>
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
  nodeCompleted,
  defaultOpen = false,
  sectionToggleSignal,
  searchTerm,
  ownerId,
  assistantId,
  getToolLoopEvents,
  onLayoutChange,
  resolvedToolCallIds,
  suppressTrailingContentIds,
  promotedDuration,
}: {
  logs: ToolLoopLog[];
  depth: number;
  nodeCompleted?: boolean;
  defaultOpen?: boolean;
  sectionToggleSignal?: SectionToggleSignal;
  searchTerm?: string;
  ownerId?: string;
  assistantId?: string;
  getToolLoopEvents?: GetToolLoopEventsFn;
  onLayoutChange?: () => void;
  resolvedToolCallIds?: Set<string>;
  suppressTrailingContentIds?: Set<number>;
  promotedDuration?: string;
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

  const pad = `${20 + depth * 8}px`;

  const sectionDuration = React.useMemo(() => {
    if (promotedDuration) return promotedDuration;
    if (logs.length < 2) return '';
    const first = new Date(logs[0].entries.eventTimestamp || logs[0].ts).getTime();
    const last = new Date(
      logs[logs.length - 1].entries.eventTimestamp || logs[logs.length - 1].ts
    ).getTime();
    const ms = last - first;
    return ms > 0 ? formatCompactDuration(ms) : '';
  }, [logs, promotedDuration]);

  const stepCount =
    suppressTrailingContentIds && suppressTrailingContentIds.size > 0
      ? logs.length - logs.reduce((n, l) => n + (suppressTrailingContentIds.has(l.id) ? 1 : 0), 0)
      : logs.length;

  return (
    <div className="min-w-0">
      {/* Toggle bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex w-full items-center gap-1 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
          'text-muted-foreground/60 hover:text-muted-foreground/90 transition-colors duration-150'
        )}
        style={{ paddingLeft: pad }}
        title={!isOpen ? 'Click to expand' : undefined}
      >
        <span>
          {stepCount} {stepCount === 1 ? 'step' : 'steps'}
          {sectionDuration && (
            <span className="text-muted-foreground/40 ml-1">· {sectionDuration}</span>
          )}
        </span>
        <ChevronRight
          className={cn(
            'h-2.5 w-2.5 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100',
            isOpen && 'rotate-90'
          )}
        />
        <div className="bg-border/30 ml-1 h-px flex-1" />
      </button>

      {/* Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <ToolLoopConversation
          logs={logs}
          depth={depth}
          nodeCompleted={nodeCompleted}
          searchTerm={searchTerm}
          ownerId={ownerId}
          assistantId={assistantId}
          getToolLoopEvents={getToolLoopEvents}
          onLayoutChange={onLayoutChange}
          resolvedToolCallIds={resolvedToolCallIds}
          suppressTrailingContentIds={suppressTrailingContentIds}
        />
      </div>
    </div>
  );
}

export function ActionNodeItem({
  node,
  ownerId,
  depth = 0,
  defaultExpanded,
  expandedNodeIds,
  onExpandedChange,
  assistantId,
  getToolLoopEvents,
  loadChildren,
  sectionToggleSignal,
  matchedIds,
  searchTerm,
  onStopAction,
  onFocusAction,
  onOpenActionInNewTab,
  className,
}: ActionNodeItemProps) {
  // Determine if we're in controlled mode
  const isControlled = expandedNodeIds !== undefined && onExpandedChange !== undefined;

  const initialExpanded = defaultExpanded ?? false;
  const [localIsExpanded, setLocalIsExpanded] = React.useState(initialExpanded);

  // Use controlled state if provided, otherwise use local state
  const isExpanded = isControlled ? expandedNodeIds.has(node.id) : localIsExpanded;

  // Full ToolLoop conversation (lazy-loaded when expanded).
  // Raw logs are stored unfiltered; the derived memo re-filters whenever
  // children change — this handles the race between loadChildren and
  // the ToolLoop fetch without blocking either.
  const [rawToolLoopLogs, setRawToolLoopLogs] = React.useState<ToolLoopLog[]>([]);
  const [isToolLoopLoading, setIsToolLoopLoading] = React.useState(false);
  const toolLoopFetchedRef = React.useRef(false);

  // Track children count as a primitive so the memo re-runs when
  // mergeNewEvents mutates node.children in place (same array reference).
  const childCount = node.children?.length ?? 0;

  const completedToolLoopLogs = React.useMemo(() => {
    if (rawToolLoopLogs.length === 0) return [];
    const children = node.children || [];
    if (children.length === 0) return rawToolLoopLogs;
    const childPrefixes = children.map((c) => c.hierarchy.join('->') + '->');
    const childExact = new Set(children.map((c) => c.hierarchy.join('->')));
    return rawToolLoopLogs.filter((l) => {
      const logKey = l.entries.hierarchy.join('->');
      if (childExact.has(logKey)) return false;
      if (childPrefixes.some((p) => logKey.startsWith(p))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- childCount is a primitive proxy for node.children which is mutated in place
  }, [rawToolLoopLogs, childCount]);

  const hasChildren = node.children && node.children.length > 0;
  const canLoadToolLoop =
    !!getToolLoopEvents && !!ownerId && !!assistantId && node.type === 'manager';
  const isExpandable = hasChildren || canLoadToolLoop;

  // Live ToolLoop logs from SSE, filtered identically to completedToolLoopLogs:
  // exclude system messages AND child-owned events so live rendering matches
  // polled rendering exactly (no duplication of descendant ToolLoop events).
  const filteredLiveToolLoopLogs = React.useMemo(() => {
    if (!node.liveToolLoopLogs) return [];
    const rewritten = rewriteCheckStatusResults(node.liveToolLoopLogs);
    const logs = rewritten.filter((l) => !isToolLoopNoise(l.entries));
    const children = node.children || [];
    if (children.length === 0) return logs;
    const childPrefixes = children.map((c) => c.hierarchy.join('->') + '->');
    const childExact = new Set(children.map((c) => c.hierarchy.join('->')));
    return logs.filter((l) => {
      const logKey = l.entries.hierarchy.join('->');
      if (childExact.has(logKey)) return false;
      if (childPrefixes.some((p) => logKey.startsWith(p))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- childCount is a primitive proxy for node.children which is mutated in place
  }, [node.liveToolLoopLogs, childCount]);

  // Unified data source: polled data supplemented with any SSE-only events
  // that haven't been persisted yet. The Orchestra fetch can race with the
  // EventBus periodic flush — SSE events may arrive before the database has
  // them, so we merge rather than hard-switch to avoid losing the response.
  // Uses fingerprint-based dedup because SSE events may carry synthetic IDs
  // (negative or 0) that differ from the database row IDs in polled data.
  const effectiveLogs = React.useMemo(
    () => deduplicateLiveLogs(completedToolLoopLogs, filteredLiveToolLoopLogs),
    [completedToolLoopLogs, filteredLiveToolLoopLogs]
  );

  // Resolved tool-call IDs computed from BOTH Orchestra and SSE logs so that
  // check_status_* synthetic completions (hidden from display by
  // isToolLoopNoise) still resolve the shimmer on original tool calls.
  // We merge both sources because the Orchestra fetch may race with the
  // EventBus periodic flush — SSE events can arrive before Orchestra has them.
  const resolvedToolCallIds = React.useMemo(() => {
    const combined = [...completedToolLoopLogs, ...(node.liveToolLoopLogs ?? [])];
    return buildResolvedToolCallIds(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedToolLoopLogs, node.liveToolLoopLogs]);

  // Label comes directly from the ManagerMethod incoming event's
  // question/instructions/request field, stored as requestContent.
  // Falls back to displayLabel/hierarchy segment for non-manager nodes.
  const effectiveLabel = node.requestContent || node.label;

  // --- Visibility gate ---
  // Root nodes (depth 0) are always visible — they always carry a meaningful
  // label (requestContent or displayLabel fallback for old data).
  // Boundary nodes are visible only when they have children.
  // Other inner nodes need requestContent, children, or to be running.
  const isVisible =
    depth === 0
      ? true
      : node.type === 'boundary'
        ? hasChildren
        : !!node.requestContent || hasChildren || node.status === 'running';

  // Extract the full request text and the final response text as standalone
  // values so they can be rendered prominently outside the collapsed steps.
  // Also tracks the log IDs so promotedLogIds can exclude them from the
  // timeline without a second search that might find a different entry.
  // Persistent actions skip this — they have no single privileged request/response.
  const promoted = React.useMemo(() => {
    if (node.persist)
      return {
        request: null,
        response: null,
        requestId: null as number | null,
        responseId: null as number | null,
        responseFromDedicatedEntry: false,
        duration: '',
      };

    let req: { content: string; time: string } | null = null;
    let requestId: number | null = null;
    let requestRawTs: string | null = null;
    const userMsg = effectiveLogs.find((l) => l.entries.message.role === 'user');
    if (userMsg) {
      const text = extractTextContent(userMsg.entries.message.content);
      if (text) {
        requestRawTs = userMsg.entries.eventTimestamp || userMsg.ts;
        req = {
          content: text,
          time: formatEventTime(requestRawTs),
        };
        requestId = userMsg.id;
      }
    }

    let resp: { content: string; time: string } | null = null;
    let responseId: number | null = null;
    let responseFromDedicatedEntry = false;
    let responseRawTs: string | null = null;

    // Prefer a dedicated kind='response' entry so the same log that gets
    // promoted is the one excluded from the timeline (no mismatch when a
    // thought with text content has a higher ID than the response).
    for (let i = effectiveLogs.length - 1; i >= 0; i--) {
      if (resolveToolLoopKind(effectiveLogs[i].entries) !== 'response') continue;
      const text = extractTextContent(effectiveLogs[i].entries.message.content);
      if (text) {
        responseRawTs = effectiveLogs[i].entries.eventTimestamp || effectiveLogs[i].ts;
        resp = {
          content: text,
          time: formatEventTime(responseRawTs),
        };
        responseId = effectiveLogs[i].id;
        responseFromDedicatedEntry = true;
        break;
      }
    }

    // Fall back to last assistant message without tool calls (covers nodes
    // where the backend doesn't emit a separate kind='response' entry).
    if (!resp) {
      for (let i = effectiveLogs.length - 1; i >= 0; i--) {
        const msg = effectiveLogs[i].entries.message;
        if (msg.role === 'assistant' && (!msg.toolCalls || msg.toolCalls.length === 0)) {
          const text = extractTextContent(msg.content);
          if (text) {
            responseRawTs = effectiveLogs[i].entries.eventTimestamp || effectiveLogs[i].ts;
            resp = {
              content: text,
              time: formatEventTime(responseRawTs),
            };
            responseId = effectiveLogs[i].id;
            break;
          }
        }
      }
    }

    let duration = '';
    if (requestRawTs && responseRawTs) {
      const ms = parseTs(responseRawTs).getTime() - parseTs(requestRawTs).getTime();
      if (ms > 0) duration = formatCompactDuration(ms);
    }

    return {
      request: req,
      response: resp,
      requestId,
      responseId,
      responseFromDedicatedEntry,
      duration,
    };
  }, [effectiveLogs, node.persist]);

  // IDs of the ToolLoop logs that are promoted (request + response) so they
  // can be excluded from the timeline — they render once in the promoted
  // section at the top of the expanded node.  Uses the IDs found by the
  // promoted memo so both always agree on which entry to exclude.
  // Persistent actions have no promoted logs — everything renders in the timeline.
  const promotedLogIds = React.useMemo(() => {
    if (node.persist) return new Set<number>();

    const ids = new Set<number>();
    if (promoted.requestId != null) ids.add(promoted.requestId);
    if (promoted.responseId != null && promoted.responseFromDedicatedEntry)
      ids.add(promoted.responseId);
    return ids;
  }, [promoted, node.persist]);

  // IDs of timeline logs whose trailing response content should be suppressed
  // because that content is already shown in the promoted section. This applies
  // when the promoted response was extracted from a thought entry (fallback)
  // rather than a dedicated kind='response' entry — the thought itself stays
  // in the timeline (for its thinking content) but its response tail is hidden.
  const suppressTrailingContentIds = React.useMemo(() => {
    const ids = new Set<number>();
    if (promoted.responseId != null && !promoted.responseFromDedicatedEntry)
      ids.add(promoted.responseId);
    return ids;
  }, [promoted]);

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

  // Load full ToolLoop conversation for completed nodes.
  // Only fires when the node is expanded — prevents thundering herd of
  // parallel requests for nodes that aren't even being viewed.
  // Uses hierarchy array + time bounds to scope results to this specific
  // invocation. After fetch, client-side filters out events that belong
  // to child MM nodes (they'll be fetched by the child's own ActionNodeItem).
  React.useEffect(() => {
    if (!canLoadToolLoop) return;
    if (!isExpanded) return;
    if (toolLoopFetchedRef.current) return;
    toolLoopFetchedRef.current = true;

    setIsToolLoopLoading(true);

    const load = async () => {
      try {
        const response = await getToolLoopEvents(
          ownerId!,
          assistantId!,
          node.hierarchy,
          null,
          node.startTime || undefined,
          node.endTime || undefined
        );
        if ('detail' in response) return;
        const logs = (response.logs || []) as ToolLoopLog[];

        // Store raw logs (minus system messages). Child-event filtering
        // happens reactively in the completedToolLoopLogs memo.
        const rewritten = rewriteCheckStatusResults(logs);
        setRawToolLoopLogs(rewritten.filter((l) => !isToolLoopNoise(l.entries)));
      } catch {
        // Silently fail
      } finally {
        setIsToolLoopLoading(false);
      }
    };

    load();
  }, [
    canLoadToolLoop,
    isExpanded,
    ownerId,
    assistantId,
    getToolLoopEvents,
    node.startTime,
    node.endTime,
    node.hierarchy,
  ]);

  // Lazy-load child manager events when a node is expanded and hasn't
  // loaded children yet. This replaces the old eager full-tree fetch.
  React.useEffect(() => {
    if (!isExpanded || !loadChildren) return;
    if (node.childrenLoaded || node.type !== 'manager') return;

    loadChildren(node.id, node.hierarchy);
  }, [isExpanded, loadChildren, node.id, node.hierarchy, node.childrenLoaded, node.type]);

  // Reset ToolLoop state when node transitions TO running (re-execution).
  // Only fires on a genuine status change, not on initial mount — otherwise
  // it would clear data the fetch effect just loaded for already-running nodes.
  const prevStatusRef = React.useRef(node.status);
  React.useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = node.status;
    if (node.status === 'running' && prev !== 'running') {
      toolLoopFetchedRef.current = false;
      setRawToolLoopLogs([]);
      setIsToolLoopLoading(false);
    }
  }, [node.status]);

  // Re-fetch ToolLoop data when the node object is rebuilt (e.g. after a
  // manual refresh). buildActionTree creates new node objects; the changed
  // reference signals that Orchestra data may now be fully persisted and
  // rawToolLoopLogs could be stale from an earlier race with persistence.
  const prevNodeRef = React.useRef(node);
  React.useEffect(() => {
    if (prevNodeRef.current !== node && node.status !== 'running' && toolLoopFetchedRef.current) {
      toolLoopFetchedRef.current = false;
    }
    prevNodeRef.current = node;
  }, [node]);

  // Determine what to render in the detail area.
  const hasToolLoopData = effectiveLogs.length > 0;

  // Expanded content is only ready once children have been lazy-loaded
  // (or there's no lazy-loading mechanism). Running nodes stream children
  // via SSE so they're always ready.
  const childrenReady =
    !loadChildren || node.childrenLoaded || node.status === 'running' || node.type === 'boundary';
  // ToolLoop-capable nodes also need their ToolLoop data before showing content.
  const toolLoopReady = !canLoadToolLoop || hasToolLoopData || !isToolLoopLoading;
  // Content is ready when polled data is fully loaded, OR we're running
  // (streaming), OR we have live data to show as a bridge during transition.
  const hasLiveData = filteredLiveToolLoopLogs.length > 0;
  const contentReady = (childrenReady && toolLoopReady) || node.status === 'running' || hasLiveData;

  const showFallbackContent = isExpanded && contentReady && !canLoadToolLoop && !!fallbackContent;

  // Build a flat log list that interleaves real ToolLoop messages with
  // synthetic entries for child nodes, positioned chronologically.
  // Each child is correlated with the tool_call_id that spawned it by
  // scanning preceding assistant messages for a matching tool call.
  const mergedLogs = React.useMemo((): ToolLoopLog[] => {
    if (!hasToolLoopData && !hasChildren) return [];

    const visibleChildren = node.children.filter((c) =>
      c.type === 'boundary'
        ? (c.children?.length ?? 0) > 0
        : !!c.requestContent || (c.children?.length ?? 0) > 0 || c.status === 'running'
    );

    if (visibleChildren.length === 0) return effectiveLogs;
    if (effectiveLogs.length === 0) {
      return visibleChildren
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((child) => makeSyntheticLog(child, null));
    }

    const childEvents = visibleChildren
      .map((c) => ({ node: c, time: new Date(c.startTime).getTime() }))
      .sort((a, b) => a.time - b.time);

    const result: ToolLoopLog[] = [];
    let logIdx = 0;

    for (const evt of childEvents) {
      while (logIdx < effectiveLogs.length) {
        const logTime = new Date(
          effectiveLogs[logIdx].entries.eventTimestamp || effectiveLogs[logIdx].ts
        ).getTime();
        if (logTime < evt.time) {
          result.push(effectiveLogs[logIdx]);
          logIdx++;
        } else {
          break;
        }
      }
      const tcId = findSpawningToolCallId(result, evt.node, node.hierarchy.length);
      result.push(makeSyntheticLog(evt.node, tcId));
    }

    while (logIdx < effectiveLogs.length) {
      result.push(effectiveLogs[logIdx]);
      logIdx++;
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- childCount is a primitive proxy for node.children which is mutated in place
  }, [hasToolLoopData, hasChildren, effectiveLogs, childCount]);

  const hasMergedData = mergedLogs.length > 0;
  const useTimeline = isExpanded && contentReady && hasMergedData;

  const presentation = resolveActionNodePresentation(node);
  const NodeIcon = presentation.icon;
  const isMatch = !!matchedIds && matchedIds.has(node.id);
  const nodeRef = React.useRef<HTMLDivElement>(null);

  if (!isVisible) return null;

  return (
    <div
      ref={nodeRef}
      data-testid="action-node"
      data-action-calling-id={depth === 0 ? node.id : undefined}
      data-type={node.type}
      data-status={node.status}
      data-match={isMatch || undefined}
      className={cn('min-w-0', className)}
      style={{ contain: 'inline-size' }}
    >
      {/* Node header */}
      <div
        className={cn(
          'group flex min-w-0 select-none rounded-sm py-0.5 pr-1 transition-colors duration-150',
          depth === 0
            ? 'flex-wrap items-start gap-x-2.5 gap-y-1 sm:flex-nowrap sm:items-center'
            : 'items-center gap-1.5',
          'hover:bg-muted/50',
          isExpandable && 'cursor-pointer',
          depth > 0 && 'ml-3'
        )}
        style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : undefined }}
        onClick={isExpandable ? handleToggle : undefined}
        data-testid={isExpandable ? 'expand-button' : undefined}
      >
        {depth === 0 ? (
          <>
            {isExpandable && (
              <ChevronRight
                className={cn(
                  'text-muted-foreground/50 h-3.5 w-3.5 shrink-0 transition-all duration-150',
                  isExpanded && 'rotate-90'
                )}
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <NodeIconBox kind={presentation.kind} icon={NodeIcon} status={node.status} />
              </TooltipTrigger>
              <TooltipContent side="top" align="start" size="sm" className="px-2 py-1 text-xs">
                {presentation.tooltip}
              </TooltipContent>
            </Tooltip>
            <span
              className={cn(
                'min-w-0 flex-1 text-[13px]',
                depth === 0
                  ? 'line-clamp-2 whitespace-normal sm:line-clamp-none sm:truncate'
                  : 'truncate',
                getLabelStyles(node.status)
              )}
            >
              <TruncatedMarkdown content={effectiveLabel} />
            </span>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
              {(onFocusAction || onOpenActionInNewTab) && (
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  {onFocusAction && (
                    <RootHeaderIconButton
                      label="Expand action"
                      testId="action-focus-button"
                      onClick={() => onFocusAction(node.id)}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </RootHeaderIconButton>
                  )}
                  {onOpenActionInNewTab && (
                    <RootHeaderIconButton
                      label="Open action in new tab"
                      testId="action-new-tab-button"
                      onClick={() => onOpenActionInNewTab(node.id)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </RootHeaderIconButton>
                  )}
                </div>
              )}
              {(node.status === 'running' || node.status === 'awaiting') && onStopAction && (
                <button
                  type="button"
                  data-testid="action-stop-button"
                  aria-label="Stop action"
                  title="Stop action"
                  className={cn(
                    'inline-flex h-6 items-center gap-1 rounded-full border border-border',
                    'bg-background px-2 text-[11px] font-semibold text-muted-foreground',
                    'hover:border-destructive/40 hover:bg-destructive/5 transition-colors hover:text-destructive'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopAction(node.id);
                  }}
                >
                  <Square className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                  Stop
                </button>
              )}
              <RootStatusPill status={node.status} />
              {node.startTime && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  <Clock className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden="true" />
                  {formatRootEventTime(node.startTime)}
                </span>
              )}
              <LiveDuration node={node} />
            </div>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex min-w-0 items-center gap-1.5">
                  <NodeIcon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      node.status === 'error'
                        ? 'text-error'
                        : node.status === 'running'
                          ? 'icon-shimmer text-muted-foreground'
                          : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'flex min-w-0 items-baseline gap-0 text-[13px]',
                      getLabelStyles(node.status)
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <TruncatedMarkdown content={effectiveLabel} />
                    </span>
                    <LiveDuration node={node} variant="inline" />
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" size="sm" className="px-2 py-1 text-xs">
                {presentation.tooltip}
              </TooltipContent>
            </Tooltip>

            {isExpandable && (
              <ChevronRight
                className={cn(
                  'text-muted-foreground/40 h-3 w-3 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100',
                  isExpanded && 'rotate-90'
                )}
              />
            )}

            {node.startTime && (
              <span className="text-muted-foreground/70 ml-auto shrink-0 pl-2 font-mono text-[10px] tabular-nums">
                {formatEventTime(node.startTime)}
              </span>
            )}
          </>
        )}
      </div>

      {/* Promoted request/response — shown prominently when expanded */}
      {isExpanded && contentReady && promoted.request && (
        <PromotedContent
          icon={ArrowDown}
          label="request"
          labelColor="text-[color:var(--status-info)]"
          content={promoted.request.content}
          depth={depth}
          timestamp={promoted.request.time}
          searchTerm={searchTerm}
        />
      )}
      {isExpanded && contentReady && promoted.response && (
        <PromotedContent
          icon={ArrowUp}
          label="final response"
          labelColor="text-[color:var(--status-success)]"
          content={promoted.response.content}
          depth={depth}
          defaultOpen
          timestamp={promoted.response.time}
          searchTerm={searchTerm}
          calloutTone={node.status === 'error' ? 'error' : 'success'}
        />
      )}

      {/* Merged timeline: ToolLoop messages and inline child nodes in strict
          chronological order. Promoted request/response logs are filtered out.
          Running nodes use LiveToolLoopTimeline for auto-scroll-to-bottom. */}
      {useTimeline &&
        (() => {
          const filtered = mergedLogs.filter((l) => !promotedLogIds.has(l.id));
          if (filtered.length === 0) return null;

          if (node.status === 'running') {
            return (
              <LiveToolLoopTimeline
                logs={filtered}
                depth={depth}
                searchTerm={searchTerm}
                ownerId={ownerId}
                assistantId={assistantId}
                getToolLoopEvents={getToolLoopEvents}
                resolvedToolCallIds={resolvedToolCallIds}
                suppressTrailingContentIds={suppressTrailingContentIds}
              />
            );
          }

          if (node.persist) {
            return (
              <ToolLoopConversation
                logs={filtered}
                depth={depth}
                nodeCompleted
                searchTerm={searchTerm}
                ownerId={ownerId}
                assistantId={assistantId}
                getToolLoopEvents={getToolLoopEvents}
                resolvedToolCallIds={resolvedToolCallIds}
                suppressTrailingContentIds={suppressTrailingContentIds}
              />
            );
          }

          return (
            <CollapsibleToolLoopSection
              logs={filtered}
              depth={depth}
              nodeCompleted
              sectionToggleSignal={sectionToggleSignal}
              searchTerm={searchTerm}
              ownerId={ownerId}
              assistantId={assistantId}
              getToolLoopEvents={getToolLoopEvents}
              resolvedToolCallIds={resolvedToolCallIds}
              suppressTrailingContentIds={suppressTrailingContentIds}
              promotedDuration={promoted.duration}
            />
          );
        })()}

      {/* Children loading indicator — shown while content isn't ready */}
      {isExpanded && !contentReady && (
        <div
          className="text-muted-foreground/40 flex items-center gap-1.5 py-1 text-[11px]"
          style={{ paddingLeft: `${20 + depth * 8}px` }}
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {/* Fallback content for non-manager leaf nodes */}
      {showFallbackContent && (
        <ContentArea content={fallbackContent!} depth={depth} maxHeight={160} />
      )}
    </div>
  );
}
