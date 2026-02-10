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
import { ChevronRight } from 'lucide-react';
import { StatusIndicator } from './StatusIndicator';
import { formatDuration, getNodeDuration } from '@/utils/assistants/assistant-actions';
import type { ActionNode, GetToolLoopEventsFn, ToolLoopLog } from '@/types/assistants/action';

export interface ActionNodeItemProps {
  /** The action node to display */
  node: ActionNode;
  /** Depth level for indentation (0 = root) */
  depth?: number;
  /** Default expanded state (defaults to true for running nodes) */
  defaultExpanded?: boolean;
  /** Assistant ID for fetching ToolLoop events */
  assistantId?: string;
  /** Function to fetch ToolLoop events (optional) */
  getToolLoopEvents?: GetToolLoopEventsFn;
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
        paddingLeft: depth > 0 ? `${depth * 12 + 36}px` : '36px',
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
            paddingLeft: depth > 0 ? `${depth * 12 + 36}px` : '36px',
            background: 'linear-gradient(to bottom, transparent, var(--background))',
          }}
        />
      )}
    </div>
  );
}

export function ActionNodeItem({
  node,
  depth = 0,
  defaultExpanded,
  assistantId,
  getToolLoopEvents,
  className,
}: ActionNodeItemProps) {
  // Running nodes are expanded by default
  const initialExpanded = defaultExpanded ?? node.status === 'running';
  const [isExpanded, setIsExpanded] = React.useState(initialExpanded);

  // Latest LLM thinking content (for running nodes)
  const [latestThinking, setLatestThinking] = React.useState<string | null>(null);

  const hasChildren = node.children && node.children.length > 0;
  const canLoadToolLoop = !!getToolLoopEvents && !!assistantId && node.type === 'manager';

  // Calculate duration
  const duration = getNodeDuration(node);
  const durationText =
    node.status === 'running' ? `${formatDuration(duration)}...` : formatDuration(duration);

  // Determine what content to display:
  // - Running: latest LLM thinking from ToolLoop
  // - Completed: node's final answer/content (if meaningful)
  const displayContent = React.useMemo(() => {
    if (node.status === 'running') {
      return latestThinking;
    }
    // For completed nodes, show the answer content if it's meaningful
    // Filter out boolean-like values and very short non-meaningful content
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
  }, [node.status, node.content, latestThinking]);

  // Handle expand/collapse toggle
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Fetch latest LLM thinking while node is running
  React.useEffect(() => {
    if (node.status !== 'running' || !canLoadToolLoop) {
      return;
    }

    let isCancelled = false;
    let isCurrentlyLoading = false;

    const fetchLatestThinking = async () => {
      // Skip if already loading to avoid overlapping requests
      if (isCurrentlyLoading) return;
      isCurrentlyLoading = true;

      try {
        // Fetch only the most recent ToolLoop event
        const response = await getToolLoopEvents(assistantId!, node.hierarchyLabel, 1);

        if (isCancelled) return;

        if ('detail' in response) {
          return;
        }

        const logs = (response.logs || []) as ToolLoopLog[];
        if (logs.length > 0) {
          const latest = logs[0];
          const message = latest.entries.message;

          // Extract content from the latest message
          let content: string | undefined;

          if (message.toolCalls && message.toolCalls.length > 0) {
            // Tool call - show tool name
            const toolCall = message.toolCalls[0];
            content = `Calling ${toolCall.function.name}...`;
          } else {
            // LLM response or tool result
            content = extractTextContent(message.content);
          }

          if (content) {
            setLatestThinking(content);
          }
        }
      } catch {
        // Silently fail - this is background loading
      } finally {
        if (!isCancelled) {
          isCurrentlyLoading = false;
        }
      }
    };

    // Initial fetch
    fetchLatestThinking();

    // Poll for updates while running (every 1.5s for responsiveness)
    const interval = setInterval(fetchLatestThinking, 1500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [node.status, node.hierarchyLabel, canLoadToolLoop, assistantId, getToolLoopEvents]);

  // Clear thinking when node completes
  React.useEffect(() => {
    if (node.status !== 'running') {
      setLatestThinking(null);
    }
  }, [node.status]);

  // Update expansion when status changes (auto-expand running nodes)
  React.useEffect(() => {
    if (node.status === 'running' && !isExpanded) {
      setIsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only trigger on status change
  }, [node.status]);

  return (
    <div
      data-testid="action-node"
      data-type={node.type}
      data-status={node.status}
      className={cn('min-w-0 select-none overflow-hidden', className)}
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
        {hasChildren ? (
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
          // Spacer for alignment when no children
          <span className="w-4.5 flex-shrink-0" />
        )}

        {/* Status indicator */}
        <StatusIndicator status={node.status} size="sm" />

        {/* Label */}
        <span className={cn('min-w-0 flex-1 truncate text-sm', getLabelStyles(node.type))}>
          {node.label}
        </span>

        {/* Duration */}
        <span className="text-caption ml-2 flex-shrink-0 tabular-nums text-muted-foreground">
          {durationText}
        </span>
      </div>

      {/* Content area - inline below header */}
      {displayContent && <ContentArea content={displayContent} depth={depth} maxHeight={80} />}

      {/* Children (with animation) */}
      {hasChildren && (
        <div
          className={cn(
            'relative overflow-hidden transition-all duration-200 ease-out',
            isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          {/* Vertical line connector */}
          <div
            className="absolute bottom-2 left-[7px] top-0 w-px bg-border"
            style={{ marginLeft: depth > 0 ? `${depth * 12 + 16}px` : '0' }}
          />

          {/* Child nodes */}
          {node.children.map((child) => (
            <ActionNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
              assistantId={assistantId}
              getToolLoopEvents={getToolLoopEvents}
            />
          ))}
        </div>
      )}
    </div>
  );
}
