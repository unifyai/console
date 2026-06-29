'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from './AssistantMarkdown';

interface ClampedAssistantMarkdownProps {
  children: string;
  /** Max height in pixels before clipping (default 120). */
  maxHeight?: number;
  className?: string;
}

/**
 * Renders markdown with a collapsible clip when content exceeds `maxHeight`.
 * Shows "View more" / "Show less" toggles for long bodies.
 */
export function ClampedAssistantMarkdown({
  children,
  maxHeight = 120,
  className,
}: ClampedAssistantMarkdownProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (expanded) return;
    const el = contentRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > maxHeight + 4);
  }, [children, maxHeight, expanded]);

  return (
    <div className={cn('mb-3', className)} data-testid="clamped-markdown">
      <div className="relative">
        <div
          ref={contentRef}
          className={cn(!expanded && overflows && 'overflow-hidden')}
          style={!expanded && overflows ? { maxHeight } : undefined}
        >
          <AssistantMarkdown>{children}</AssistantMarkdown>
        </div>
        {!expanded && overflows && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-caption mt-1 font-medium text-primary hover:underline"
          data-testid="clamped-markdown-toggle"
        >
          {expanded ? 'Show less' : 'View more…'}
        </button>
      )}
    </div>
  );
}
