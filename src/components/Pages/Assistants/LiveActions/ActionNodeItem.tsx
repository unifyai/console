/**
 * ActionNodeItem - Displays a single action node in the tree.
 *
 * Features:
 * - Shimmer text for running nodes, red-tinted text for errors, muted text for completed
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
  Bookmark,
  Users,
  FileText,
  BookOpen,
  PenLine,
  RefreshCw,
  ListChecks,
  Cpu,
  KeyRound,
  Wrench,
  MessageSquare,
  Globe,
  MessageCircle,
  CircleDot,
  HelpCircle,
  XCircle,
  Pause,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { dracula, docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import type {
  ActionInteraction,
  ActionNode,
  ActionNodeStatus,
  GetToolLoopEventsFn,
  ToolLoopLog,
} from '@/types/assistants/action';

const SHOW_EXECUTE_CODE_CONTENT = true;

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
 * Get label styling based on node status.
 */
function getLabelStyles(status: ActionNodeStatus): string {
  if (status === 'error') return 'text-red-500/70 font-normal';
  if (status === 'running') return 'text-muted-foreground font-normal';
  return 'text-muted-foreground font-normal';
}

/**
 * Map a display label to its icon. Exact matches first, then fuzzy substring
 * matches, with a generic fallback for unknown labels.
 */
function getNodeIcon(displayLabel?: string): LucideIcon {
  if (!displayLabel) return CircleDot;
  if (displayLabel === 'Taking Action') return Zap;
  if (displayLabel === 'Running Code') return SquareTerminal;
  if (displayLabel.startsWith('Running:')) return Play;
  if (displayLabel === 'Storing Reusable Skills') return Bookmark;
  if (displayLabel === 'Reading File') return FileText;
  if (displayLabel === 'Processing Memory Chunk') return Cpu;
  if (displayLabel === 'Working on Task') return Wrench;
  if (displayLabel === 'Reorganizing Notes') return RefreshCw;
  if (displayLabel === 'Searching the Web') return Globe;
  if (displayLabel === 'Answering Question') return MessageCircle;
  if (displayLabel.includes('Contact')) return Users;
  if (displayLabel.includes('Notes') || displayLabel.includes('Knowledge')) return BookOpen;
  if (displayLabel.includes('Credential') || displayLabel.includes('Secret')) return KeyRound;
  if (displayLabel.includes('Task')) return ListChecks;
  if (displayLabel.includes('Conversation') || displayLabel.includes('Transcript'))
    return MessageSquare;
  return CircleDot;
}

/**
 * Parse a timestamp string, ensuring UTC interpretation.
 */
function parseTs(ts: string): Date {
  return new Date(ts.endsWith('Z') || ts.includes('+') || ts.includes('-', 10) ? ts : ts + 'Z');
}

/**
 * Format a timestamp string to a short local time (HH:MM:SS).
 */
function formatEventTime(ts: string): string {
  return parseTs(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format a timestamp as mm/dd/yy · HH:MM:SS for root-level nodes.
 */
function formatEventDateTime(ts: string): string {
  const d = parseTs(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const time = d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${month}/${day}/${year} · ${time}`;
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
 * Live-ticking duration badge. Ticks every second while running,
 * shows static duration when completed/errored.
 */
function LiveDuration({ node }: { node: ActionNode }) {
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

  return (
    <span className="text-muted-foreground/40 ml-1.5 shrink-0 text-[10px] tabular-nums">
      · {formatCompactDuration(elapsed)}
    </span>
  );
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
    <pre className="bg-muted/50 my-1 overflow-x-auto rounded px-2 py-1.5 text-[10px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children, ...props }: any) => (
    <code className="bg-muted/50 rounded px-1 py-0.5 text-[10px]" {...props}>
      {children}
    </code>
  ),
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500/70 underline">
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
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500/70 underline">
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
          <pre className="bg-muted/50 overflow-x-auto rounded px-2 py-1.5 text-[10px] leading-relaxed">
            <code>{formatted}</code>
          </pre>
        );
      }

      const hlStyle = theme && ['dark', 'system'].includes(theme) ? dracula : docco;

      return (
        <pre className="bg-muted/50 overflow-x-auto rounded px-2 py-1.5 text-[10px] leading-relaxed">
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
        paddingLeft: `${28 + depth * 16}px`,
        maxWidth: `calc(100% - ${depth * 16 + 16}px)`,
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
        <RichContent content={content} />
      </div>

      {/* Subtle fade at bottom when overflowing */}
      {isOverflowing && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-4"
          style={{
            paddingLeft: `${28 + depth * 16}px`,
            background: 'linear-gradient(to bottom, transparent, var(--background))',
          }}
        />
      )}
    </div>
  );
}

/**
 * Renders a single ToolLoop message with a role tag, content, and right-justified timestamp.
 */
function ToolLoopMessage({ log }: { log: ToolLoopLog }) {
  const { message } = log.entries;
  const time = formatEventTime(log.entries.eventTimestamp || log.ts);
  const { theme } = useTheme();

  if (message.role === 'system') return null;

  const timeLabel = (
    <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
      {time}
    </span>
  );

  if (message.role === 'user') {
    const content = extractTextContent(message.content);
    if (!content) return null;
    return (
      <div className="flex gap-2">
        <span className="shrink-0 font-medium text-blue-500/60">request</span>
        <div className="text-muted-foreground/70 min-w-0 flex-1">
          <RichContent content={content} />
        </div>
        {timeLabel}
      </div>
    );
  }

  if (message.role === 'assistant') {
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolNames = message.toolCalls.map((tc) => `${tc.function.name}()`).join(', ');

      const codeBlocks: Array<{ lang: string; code: string }> = [];
      if (SHOW_EXECUTE_CODE_CONTENT) {
        for (const tc of message.toolCalls) {
          if (tc.function.name !== 'execute_code') continue;
          try {
            const args = JSON.parse(tc.function.arguments);
            if (args.code) codeBlocks.push({ lang: args.language || 'python', code: args.code });
          } catch {
            /* skip malformed arguments */
          }
        }
      }

      const hlStyle = theme && ['dark', 'system'].includes(theme) ? dracula : docco;

      return (
        <div className="flex gap-2">
          <span className="shrink-0 font-medium text-orange-500/60">call</span>
          <div className="text-muted-foreground/70 min-w-0 flex-1">
            <span>{toolNames}</span>
            {codeBlocks.map((block, i) => (
              <SyntaxHighlighter
                key={i}
                language={block.lang}
                style={hlStyle}
                customStyle={{
                  fontSize: '10px',
                  lineHeight: '1.4',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  margin: '4px 0 0 0',
                }}
              >
                {block.code.trim()}
              </SyntaxHighlighter>
            ))}
          </div>
          {timeLabel}
        </div>
      );
    }
    const content = extractTextContent(message.content);
    if (!content) return null;
    return (
      <div className="flex gap-2">
        <span className="shrink-0 font-medium text-green-500/60">response</span>
        <div className="text-muted-foreground/70 min-w-0 flex-1">
          <RichContent content={content} />
        </div>
        {timeLabel}
      </div>
    );
  }

  if (message.role === 'tool') {
    const content = extractTextContent(message.content);
    if (!content) return null;
    return (
      <div className="flex gap-2">
        <span className="shrink-0 font-medium text-purple-500/60">result</span>
        <div className="text-muted-foreground/70 min-w-0 flex-1">
          <RichContent content={content} />
        </div>
        {timeLabel}
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

  const pad = depth > 0 ? `${depth * 16 + 36}px` : '36px';

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
 * Live ToolLoop timeline for running nodes.
 * Auto-scrolls to the bottom as new events arrive unless the user
 * has manually scrolled up to inspect older events.
 */
function LiveToolLoopTimeline({ logs, depth }: { logs: ToolLoopLog[]; depth: number }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = React.useRef(false);
  const prevLogCountRef = React.useRef(0);

  // Detect manual scroll: mark as "scrolled up" if not near the bottom
  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distFromBottom > 40;
  }, []);

  // Auto-scroll when new logs arrive (unless user scrolled up)
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

  const pad = depth > 0 ? `${depth * 16 + 36}px` : '36px';

  return (
    <div className="relative" style={{ paddingLeft: pad, paddingRight: '8px' }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="styled-scrollbar overflow-y-auto rounded-md text-[11px] leading-relaxed"
        style={{ maxHeight: '260px' }}
      >
        <div className="space-y-0.5 py-2">
          {logs.map((log) => (
            <ToolLoopMessage key={log.id} log={log} />
          ))}
        </div>
      </div>

      {/* Bottom fade when scrolled up */}
      {isUserScrolledUpRef.current && (
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

  const pad = `${28 + depth * 16}px`;

  const sectionDuration = React.useMemo(() => {
    if (logs.length < 2) return '';
    const first = new Date(logs[0].entries.eventTimestamp || logs[0].ts).getTime();
    const last = new Date(
      logs[logs.length - 1].entries.eventTimestamp || logs[logs.length - 1].ts
    ).getTime();
    const ms = last - first;
    return ms > 0 ? formatCompactDuration(ms) : '';
  }, [logs]);

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
        <span>
          {logs.length} {logs.length === 1 ? 'step' : 'steps'}
          {sectionDuration && (
            <span className="text-muted-foreground/25 ml-1">· {sectionDuration}</span>
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
        <ToolLoopConversation logs={logs} depth={depth} />
      </div>
    </div>
  );
}

const INTERACTION_LABELS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  interject: { label: 'interjected', color: 'text-amber-500/70', icon: PenLine },
  stop: { label: 'stopped', color: 'text-red-500/70', icon: XCircle },
  pause: { label: 'paused', color: 'text-yellow-500/70', icon: Pause },
  resume: { label: 'resumed', color: 'text-green-500/70', icon: Play },
  ask: { label: 'asked', color: 'text-blue-500/70', icon: HelpCircle },
  answerClarification: { label: 'clarified', color: 'text-violet-500/70', icon: CheckCircle },
};

/**
 * Renders a mid-flight interaction annotation (e.g. "interjected", "stopped").
 */
function InteractionEvent({
  interaction,
  depth,
}: {
  interaction: ActionInteraction;
  depth: number;
}) {
  const config = INTERACTION_LABELS[interaction.action] ?? {
    label: interaction.action,
    color: 'text-muted-foreground/70',
    icon: CircleDot,
  };
  const InteractionIcon = config.icon;

  const hasContent = !!interaction.content;
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div
      className={cn(
        'group rounded-sm py-0.5 text-[11px] transition-colors duration-150',
        hasContent && 'hover:bg-muted/40 cursor-pointer'
      )}
      style={{ paddingLeft: `${28 + depth * 16}px` }}
      onClick={hasContent ? () => setIsOpen((v) => !v) : undefined}
    >
      <div className="flex items-center gap-1.5">
        <InteractionIcon className={cn('h-3 w-3 shrink-0', config.color)} />
        <span className={cn('shrink-0 text-[11px] font-medium', config.color)}>{config.label}</span>
        {hasContent && !isOpen && (
          <span className="text-muted-foreground/50 line-clamp-1 min-w-0 flex-1">
            <TruncatedMarkdown content={interaction.content!} />
          </span>
        )}
        {hasContent && (
          <ChevronRight
            className={cn(
              'text-muted-foreground/40 h-2.5 w-2.5 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100',
              isOpen && 'rotate-90'
            )}
          />
        )}
        <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
          {formatEventTime(interaction.timestamp)}
        </span>
      </div>

      {hasContent && isOpen && (
        <div className="text-muted-foreground/70 styled-scrollbar mt-1 max-h-[120px] overflow-y-auto text-[11px] leading-relaxed">
          <RichContent content={interaction.content!} />
        </div>
      )}
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

  // Full ToolLoop conversation (lazy-loaded for completed nodes)
  const [completedToolLoopLogs, setCompletedToolLoopLogs] = React.useState<ToolLoopLog[]>([]);
  const [isToolLoopLoading, setIsToolLoopLoading] = React.useState(false);
  const toolLoopFetchedRef = React.useRef(false);

  const hasChildren = node.children && node.children.length > 0;
  const canLoadToolLoop = !!getToolLoopEvents && !!assistantId && node.type === 'manager';
  const isExpandable = hasChildren || canLoadToolLoop;

  // Live ToolLoop logs from SSE — shown while running and kept as a bridge
  // after completion until the lazy-loaded historical data arrives.
  const liveToolLoopLogs = React.useMemo(() => {
    if (!node.liveToolLoopLogs) return [];
    return node.liveToolLoopLogs.filter((l) => l.entries.message.role !== 'system');
  }, [node.liveToolLoopLogs]);

  // Derive label from the first ToolLoop user message (the request that
  // kicked off this action). Falls back to displayLabel/hierarchy segment
  // when no ToolLoop data is available yet.
  const effectiveLabel = React.useMemo(() => {
    const liveLogs = node.liveToolLoopLogs ?? [];
    const liveUserMsg = liveLogs.find((l) => l.entries.message.role === 'user');
    if (liveUserMsg) {
      const text = extractTextContent(liveUserMsg.entries.message.content);
      if (text) return text;
    }
    const completedUserMsg = completedToolLoopLogs.find((l) => l.entries.message.role === 'user');
    if (completedUserMsg) {
      const text = extractTextContent(completedUserMsg.entries.message.content);
      if (text) return text;
    }
    return node.label;
  }, [node.liveToolLoopLogs, completedToolLoopLogs, node.label]);

  // --- Label animation system ---
  const hasAnyToolLoopData =
    (node.liveToolLoopLogs && node.liveToolLoopLogs.length > 0) || completedToolLoopLogs.length > 0;
  const isLabelPending =
    effectiveLabel === node.label &&
    canLoadToolLoop &&
    (node.status === 'running' ? !hasAnyToolLoopData : isToolLoopLoading);

  const [displayedLabel, setDisplayedLabel] = React.useState(effectiveLabel);
  const prevLabelRef = React.useRef(effectiveLabel);
  const animRef = React.useRef<number | null>(null);
  const [labelFading, setLabelFading] = React.useState(false);

  React.useEffect(() => {
    const prev = prevLabelRef.current;
    prevLabelRef.current = effectiveLabel;
    if (effectiveLabel === prev) return;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const isLiveSwap = node.status === 'running' && prev === node.label;

    if (isLiveSwap) {
      let idx = 0;
      const step = () => {
        idx = Math.min(idx + 10, effectiveLabel.length);
        setDisplayedLabel(effectiveLabel.slice(0, idx));
        if (idx < effectiveLabel.length) {
          animRef.current = requestAnimationFrame(step);
        }
      };
      animRef.current = requestAnimationFrame(step);
    } else {
      setLabelFading(true);
      const t = setTimeout(() => {
        setDisplayedLabel(effectiveLabel);
        setLabelFading(false);
      }, 100);
      return () => clearTimeout(t);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [effectiveLabel, node.status, node.label]);

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
  // Fires immediately on completion (no expansion gate) so data is ready
  // when the user expands the node — and so step counts can be computed
  // even while the node is collapsed.
  // Uses hierarchy array + time bounds to scope results to this specific
  // invocation. Without time bounds, the hierarchy prefix would match
  // events from ALL invocations — producing a garbled interleaved timeline.
  // After fetch, client-side filters out events that belong to child MM
  // nodes (they'll be fetched by the child's own ActionNodeItem).
  React.useEffect(() => {
    if (node.status === 'running' || !canLoadToolLoop) return;
    if (toolLoopFetchedRef.current) return;
    toolLoopFetchedRef.current = true;

    setIsToolLoopLoading(true);

    const load = async () => {
      try {
        const response = await getToolLoopEvents(
          assistantId!,
          node.hierarchy,
          null,
          node.startTime || undefined,
          node.endTime || undefined
        );
        if ('detail' in response) return;
        const logs = (response.logs || []) as ToolLoopLog[];

        // Snapshot children at resolution time (not at effect setup time)
        // so we filter against the most up-to-date tree.
        const children = node.children || [];
        const childPrefixes = children.map((c) => c.hierarchy.join('->') + '->');
        const childExact = new Set(children.map((c) => c.hierarchy.join('->')));

        setCompletedToolLoopLogs(
          logs.filter((l) => {
            if (l.entries.message.role === 'system') return false;
            const logKey = l.entries.hierarchy.join('->');
            if (childExact.has(logKey)) return false;
            if (childPrefixes.some((p) => logKey.startsWith(p))) return false;
            return true;
          })
        );
      } catch {
        // Silently fail
      } finally {
        setIsToolLoopLoading(false);
      }
    };

    load();
    // No cleanup — once toolLoopFetchedRef is set, the effect won't re-run.
    // React 18+ safely ignores setState on unmounted components.
  }, [
    node.status,
    canLoadToolLoop,
    assistantId,
    getToolLoopEvents,
    node.startTime,
    node.endTime,
    node.hierarchy,
    node.children,
  ]);

  // Reset completed ToolLoop state when node starts running again
  React.useEffect(() => {
    if (node.status === 'running') {
      toolLoopFetchedRef.current = false;
      setCompletedToolLoopLogs([]);
      setIsToolLoopLoading(false);
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
  const hasToolLoopData = completedToolLoopLogs.length > 0;
  // Show the live SSE timeline while running, and keep showing it after
  // completion as a bridge until the lazy-loaded historical data arrives.
  const showLiveTimeline =
    isExpanded && liveToolLoopLogs.length > 0 && !hasToolLoopData && !isToolLoopLoading;
  const showFallbackContent = isExpanded && !canLoadToolLoop && !!fallbackContent;
  const hasInteractions = (node.interactions?.length ?? 0) > 0;

  // Enrich interactions with content extracted from ToolLoop data.
  // interject() injects a message into the existing loop queue — the next
  // ToolLoop "user" message IS the interjection text. Show it inline.
  const enrichedInteractions = React.useMemo(() => {
    if (!node.interactions?.length || !completedToolLoopLogs.length) return node.interactions;
    return node.interactions.map((interaction) => {
      if (interaction.content || interaction.action !== 'interject') return interaction;
      const interactionTime = new Date(interaction.timestamp).getTime();
      const nextUserMsg = completedToolLoopLogs.find((log) => {
        const logTime = new Date(log.entries.eventTimestamp || log.ts).getTime();
        return logTime >= interactionTime && log.entries.message.role === 'user';
      });
      if (nextUserMsg) {
        const content = extractTextContent(nextUserMsg.entries.message.content);
        if (content) return { ...interaction, content };
      }
      return interaction;
    });
  }, [node.interactions, completedToolLoopLogs]);

  // Build a strictly chronological timeline that interleaves ToolLoop segments,
  // child nodes, and interaction annotations. Each child/interaction timestamp
  // acts as a split point so ToolLoop events before it render above, after below.
  type TimelineSegment =
    | { kind: 'steps'; logs: ToolLoopLog[]; key: string }
    | { kind: 'child'; node: ActionNode }
    | { kind: 'interaction'; interaction: ActionInteraction };

  type TimelineEvent =
    | { kind: 'child'; node: ActionNode; time: number }
    | { kind: 'interaction'; interaction: ActionInteraction; time: number };

  const timeline = React.useMemo((): TimelineSegment[] => {
    if (!hasToolLoopData && !hasChildren && !hasInteractions) return [];

    // Merge children and interactions into a unified chronological event list
    const timelineEvents: TimelineEvent[] = [
      ...node.children.map((c) => ({
        kind: 'child' as const,
        node: c,
        time: new Date(c.startTime).getTime(),
      })),
      ...(enrichedInteractions ?? []).map((i) => ({
        kind: 'interaction' as const,
        interaction: i,
        time: new Date(i.timestamp).getTime(),
      })),
    ].sort((a, b) => a.time - b.time);

    // No ToolLoop data — just list events in chronological order
    if (!hasToolLoopData) {
      return timelineEvents.map((evt) =>
        evt.kind === 'child'
          ? { kind: 'child' as const, node: evt.node }
          : { kind: 'interaction' as const, interaction: evt.interaction }
      );
    }

    // No events — single steps block
    if (timelineEvents.length === 0) {
      return [{ kind: 'steps' as const, logs: completedToolLoopLogs, key: 'all' }];
    }

    // Interleave: walk through ToolLoop logs and events together,
    // splitting ToolLoop logs at each event's timestamp.
    const result: TimelineSegment[] = [];
    let logIdx = 0;

    for (const evt of timelineEvents) {
      const segment: ToolLoopLog[] = [];

      while (logIdx < completedToolLoopLogs.length) {
        if (
          new Date(
            completedToolLoopLogs[logIdx].entries.eventTimestamp || completedToolLoopLogs[logIdx].ts
          ).getTime() < evt.time
        ) {
          segment.push(completedToolLoopLogs[logIdx]);
          logIdx++;
        } else {
          break;
        }
      }

      const evtKey = evt.kind === 'child' ? evt.node.id : `int-${evt.interaction.id}`;
      if (segment.length > 0) {
        result.push({ kind: 'steps', logs: segment, key: `pre-${evtKey}` });
      }

      if (evt.kind === 'child') {
        result.push({ kind: 'child', node: evt.node });
      } else {
        result.push({ kind: 'interaction', interaction: evt.interaction });
      }
    }

    // Remaining logs after the last event
    if (logIdx < completedToolLoopLogs.length) {
      result.push({
        kind: 'steps',
        logs: completedToolLoopLogs.slice(logIdx),
        key: 'post',
      });
    }

    // When an interject interaction already shows its content inline,
    // drop the duplicate ToolLoop user message from the steps segment
    // that immediately follows it (interject() injects the message into
    // the loop queue, so it appears as the first user turn in the next
    // steps block — showing it twice is redundant).
    for (let i = 0; i < result.length; i++) {
      const seg = result[i];
      if (
        seg.kind === 'interaction' &&
        seg.interaction.action === 'interject' &&
        seg.interaction.content
      ) {
        const next = result[i + 1];
        if (next?.kind === 'steps' && next.logs.length > 0) {
          const first = next.logs[0];
          if (first.entries.message.role === 'user') {
            next.logs = next.logs.slice(1);
          }
        }
      }
    }

    return result;
  }, [
    hasToolLoopData,
    hasChildren,
    hasInteractions,
    completedToolLoopLogs,
    node.children,
    enrichedInteractions,
  ]);

  // Whether to use the interleaved timeline renderer
  const useTimeline = isExpanded && (hasToolLoopData || hasInteractions);

  const NodeIcon = getNodeIcon(node.displayLabel);

  return (
    <div
      data-testid="action-node"
      data-type={node.type}
      data-status={node.status}
      className={cn('min-w-0', className)}
      style={{ contain: 'inline-size' }}
    >
      {/* Node header */}
      <div
        className={cn(
          'group flex min-w-0 select-none items-center gap-1.5 rounded-sm py-0.5 pr-1',
          'hover:bg-muted/50 transition-colors duration-150',
          isExpandable && 'cursor-pointer',
          depth > 0 && 'ml-3'
        )}
        style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : undefined }}
        onClick={isExpandable ? handleToggle : undefined}
        data-testid={isExpandable ? 'expand-button' : undefined}
      >
        {/* Type icon */}
        <NodeIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            node.status === 'error'
              ? 'text-red-500/50'
              : node.status === 'running'
                ? 'text-muted-foreground/50 animate-shimmer'
                : 'text-muted-foreground/40'
          )}
        />

        {/* Label + Duration */}
        <span
          className={cn(
            'flex min-w-0 items-baseline gap-0 text-xs',
            getLabelStyles(node.status),
            isLabelPending && 'animate-shimmer',
            'transition-opacity duration-150',
            labelFading && 'opacity-0'
          )}
          title={effectiveLabel}
        >
          <span className="line-clamp-1">
            <TruncatedMarkdown content={displayedLabel} />
          </span>
          <LiveDuration node={node} />
        </span>

        {/* Expand/collapse chevron — next to duration, visible on hover */}
        {isExpandable && (
          <ChevronRight
            className={cn(
              'text-muted-foreground/40 h-3 w-3 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100',
              isExpanded && 'rotate-90'
            )}
          />
        )}

        {/* Right-aligned start time */}
        {node.startTime && (
          <span className="text-muted-foreground/30 ml-auto shrink-0 pl-2 text-[10px] tabular-nums">
            {depth === 0 ? formatEventDateTime(node.startTime) : formatEventTime(node.startTime)}
          </span>
        )}
      </div>

      {/* Live ToolLoop timeline — scrollable, auto-scrolls to bottom */}
      {showLiveTimeline && <LiveToolLoopTimeline logs={liveToolLoopLogs} depth={depth} />}

      {/* Interleaved timeline: ToolLoop segments, children, and interactions
          in strict chronological order. */}
      {useTimeline &&
        timeline.map((segment) => {
          if (segment.kind === 'steps') {
            return (
              <CollapsibleToolLoopSection
                key={segment.key}
                logs={segment.logs}
                depth={depth}
                sectionToggleSignal={sectionToggleSignal}
              />
            );
          }
          if (segment.kind === 'interaction') {
            return (
              <InteractionEvent
                key={`int-${segment.interaction.id}`}
                interaction={segment.interaction}
                depth={depth}
              />
            );
          }
          return (
            <div key={segment.node.id} className="relative">
              <div
                className="absolute bottom-0 left-[7px] top-0 w-px bg-border"
                style={{ marginLeft: depth > 0 ? `${depth * 16 + 12}px` : '0' }}
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
          );
        })}

      {/* Standard children rendering — while running (no ToolLoop yet) or
          for completed nodes without ToolLoop data. */}
      {!useTimeline && hasChildren && (
        <div
          className={cn(
            'relative overflow-hidden transition-all duration-200 ease-out',
            isExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div
            className="absolute bottom-2 left-[7px] top-0 w-px bg-border"
            style={{ marginLeft: depth > 0 ? `${depth * 16 + 12}px` : '0' }}
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
