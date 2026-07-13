'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { formatDetailValue } from '@/utils/assistants/brain';

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogg', 'webm']);

interface DataRowDetailProps {
  row: Record<string, unknown> | null;
  title: string;
  description?: string;
  onClose: () => void;
}

type MediaKind = 'image' | 'video';

function mediaKindFor(value: unknown): MediaKind | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('data:image/')) return 'image';

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const extension = url.pathname.split('.').pop()?.toLowerCase();
    if (extension && IMAGE_EXTENSIONS.has(extension)) return 'image';
    if (extension && VIDEO_EXTENSIONS.has(extension)) return 'video';
  } catch {
    return null;
  }

  return null;
}

function DataMediaPreview({ value, field }: { value: unknown; field: string }) {
  const kind = mediaKindFor(value);
  const [hasFailed, setHasFailed] = React.useState(false);

  React.useEffect(() => setHasFailed(false), [value]);

  if (!kind || typeof value !== 'string') return null;

  return (
    <div className="bg-muted/20 mt-2 overflow-hidden rounded-md border border-border">
      {!hasFailed && kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${field} preview`}
          className="max-h-80 w-full object-contain"
          onError={() => setHasFailed(true)}
          data-testid="data-row-media-image"
        />
      ) : !hasFailed ? (
        <video
          src={value}
          controls
          preload="metadata"
          className="max-h-80 w-full"
          onError={() => setHasFailed(true)}
          data-testid="data-row-media-video"
        />
      ) : null}
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-caption block truncate border-t border-border px-2 py-1.5 text-primary hover:underline"
      >
        Open media
      </a>
    </div>
  );
}

export function DataRowDetail({ row, title, description, onClose }: DataRowDetailProps) {
  const [snapshot, setSnapshot] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    if (row) setSnapshot(row);
  }, [row]);

  const displayRow = row ?? snapshot;
  const fields = React.useMemo(
    () => Object.entries(displayRow ?? {}).filter(([key]) => !key.startsWith('_')),
    [displayRow]
  );

  return (
    <Sheet
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full max-w-[min(100vw,42rem)] flex-col"
        data-testid="data-row-detail"
        onAnimationEnd={() => {
          if (!row) setSnapshot(null);
        }}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="break-all">{title}</SheetTitle>
          <SheetDescription>
            {description ?? `${fields.length} ${fields.length === 1 ? 'field' : 'fields'}`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1">
          <dl className="space-y-4 pr-4" data-testid="data-row-detail-fields">
            {fields.map(([key, value]) => {
              const formatted = formatDetailValue(key, value);
              return (
                <div key={key} className="group/field">
                  <dt className="text-title flex items-center justify-between gap-3">
                    <span className="min-w-0 break-all">{key}</span>
                    {formatted !== '—' && (
                      <CopyButton
                        content={formatted}
                        tooltipContent="Copy value"
                        className="h-5 w-5 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/field:opacity-100"
                      />
                    )}
                  </dt>
                  <dd className="text-caption mt-1">
                    <pre className="bg-muted/30 max-w-full whitespace-pre-wrap break-words rounded-md border border-border p-2 font-mono text-[11px] leading-relaxed text-foreground">
                      {formatted}
                    </pre>
                    <DataMediaPreview value={value} field={key} />
                  </dd>
                </div>
              );
            })}
          </dl>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
