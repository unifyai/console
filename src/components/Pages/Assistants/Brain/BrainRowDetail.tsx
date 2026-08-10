'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useTheme } from 'next-themes';
import oneLight from '@/components/Pages/Interfaces/Blocks/Selection/Views/Markdown/Themes/one-light';
import oneDark from '@/components/Pages/Interfaces/Blocks/Selection/Views/Markdown/Themes/one-dark';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { formatDetailValue, BRAIN_CONTEXT_LABELS } from '@/utils/assistants/brain';
import { buildTaskDetailSections } from '@/utils/assistants/tasks';
import type { BrainContext, TaskBrainView } from '@/types/assistants/brain';

function BrainCodeBlock({ className, children, inline: providedInline, ...props }: any) {
  const codeString = String(children).replace(/\n$/, '');
  const isInline =
    providedInline !== undefined ? providedInline : !codeString.includes('\n') && !className;
  const { theme } = useTheme();
  const style = theme === 'dark' ? oneDark : oneLight;
  const match = /language-(\w+)/.exec(className || '');

  if (!isInline) {
    return (
      <SyntaxHighlighter
        style={style as Record<string, React.CSSProperties>}
        language={match ? match[1] : 'text'}
        PreTag="div"
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '0.75em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'auto',
          maxWidth: '100%',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--code-border)',
          backgroundColor: 'var(--code-bg)',
          color: 'var(--code-fg)',
          fontSize: '0.75rem',
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    );
  }

  return (
    <code
      className={(className ? className + ' ' : '') + 'font-mono'}
      style={{
        display: 'inline',
        backgroundColor: 'var(--code-bg)',
        color: 'var(--code-fg)',
        padding: '0.2em 0.4em',
        borderRadius: '3px',
        fontSize: '85%',
        whiteSpace: 'pre-wrap',
        border: '1px solid var(--code-border)',
      }}
      {...props}
    >
      {children}
    </code>
  );
}

const FUNCTION_CODE_KEYS = new Set(['implementation', 'argspec']);

function prepareMarkdownValue(
  key: string,
  formatted: string,
  context: BrainContext,
  row: Record<string, unknown> | null
): string {
  if (!formatted || formatted === '—') return formatted;
  if (context === 'Functions' && FUNCTION_CODE_KEYS.has(key)) {
    const lang = (row?.language as string) || '';
    return `\`\`\`${lang}\n${formatted}\n\`\`\``;
  }
  return formatted;
}

const TASK_DETAIL_DESCRIPTIONS: Record<TaskBrainView, string> = {
  Tasks: 'What this task does, how it starts, and when it is due.',
  Activity: 'What happened, why it started, and when it ran.',
};

interface BrainRowDetailProps {
  row: Record<string, unknown> | null;
  context: BrainContext;
  taskView?: TaskBrainView;
  title?: string;
  onClose: () => void;
}

const MIN_WIDTH = 380;
const MAX_WIDTH = 1200;

/**
 * Where this drawer opens before the user drags it.
 *
 * The same ~40% of the viewport every other drawer uses (see
 * `DRAWER_WIDTH_CLASS` in the sheet primitive), computed rather than
 * declared because this one is resizable and so drives its width from
 * state. Clamped by the drag bounds, so an opened width and a dragged
 * width live on one scale.
 */
function defaultDrawerWidth(): number {
  if (typeof window === 'undefined') return MIN_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.4)));
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true
  );
  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function BrainRowDetail({ row, context, taskView, title, onClose }: BrainRowDetailProps) {
  const [snapshot, setSnapshot] = React.useState<Record<string, unknown> | null>(null);
  const [width, setWidth] = React.useState(defaultDrawerWidth);
  const [isResizing, setIsResizing] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  React.useEffect(() => {
    if (row) setSnapshot(row);
  }, [row]);

  const handleDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const delta = startX - moveEvent.clientX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      };

      const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [width]
  );

  const displayRow = row ?? snapshot;
  const sections = React.useMemo(() => {
    if (!displayRow) return [];
    if (context === 'Tasks') return buildTaskDetailSections(displayRow);
    return [
      {
        title: 'Fields',
        items: Object.entries(displayRow)
          .filter(([key]) => !key.startsWith('_'))
          .map(([key, value]) => ({
            key,
            label: key,
            value,
          })),
      },
    ];
  }, [context, displayRow]);
  const totalFields = sections.reduce((sum, section) => sum + section.items.length, 0);
  const description =
    context === 'Tasks' && taskView
      ? TASK_DETAIL_DESCRIPTIONS[taskView]
      : `${totalFields} ${totalFields === 1 ? 'field' : 'fields'}`;

  return (
    <Sheet
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        ref={contentRef}
        side="right"
        className={isDesktop ? 'flex !max-w-none flex-col' : 'flex flex-col'}
        style={
          isDesktop
            ? { width, minWidth: MIN_WIDTH, ...(isResizing ? { transition: 'none' } : {}) }
            : undefined
        }
        data-testid="brain-row-detail"
        onAnimationEnd={() => {
          if (!row) setSnapshot(null);
        }}
      >
        {/* Drag handle on the left edge — desktop only */}
        {isDesktop && (
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 z-[60] h-full w-2 cursor-col-resize transition-colors hover:bg-primary-tint-30 active:bg-primary-tint-50"
          />
        )}

        <SheetHeader className="shrink-0">
          <SheetTitle>{title ?? `${BRAIN_CONTEXT_LABELS[context] ?? context} Detail`}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1">
          <div className="space-y-5 pr-4" data-testid="brain-row-detail-fields">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </h3>
                <dl className="space-y-3">
                  {section.items.map((item) => {
                    const formatted = formatDetailValue(item.key, item.value);
                    const markdown = prepareMarkdownValue(item.key, formatted, context, displayRow);
                    return (
                      <div key={item.key} className="group/field relative">
                        <dt className="text-title flex items-center justify-between">
                          {item.label}
                          {formatted && formatted !== '—' && (
                            <CopyButton
                              content={formatted}
                              tooltipContent="Copy value"
                              className="h-5 w-5 opacity-0 transition-opacity group-hover/field:opacity-100"
                            />
                          )}
                        </dt>
                        <dd className="text-caption mt-0.5 break-words">
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{ code: BrainCodeBlock }}
                            className="prose-xs prose max-w-none dark:prose-invert prose-headings:text-sm prose-p:my-1 prose-p:text-xs prose-a:text-primary prose-code:text-xs prose-pre:my-1 prose-pre:bg-transparent prose-pre:p-0 prose-pre:text-xs"
                          >
                            {markdown}
                          </Markdown>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
