'use client';

import * as React from 'react';
import { getValueType } from '@/components/Pages/Interfaces/Blocks/Selection/Views/ViewTypes';
import { cn } from '@/lib/utils';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Compact in-grid cell renderer — images/audio/markdown-ish text truncate.
 * Full inspection lives in LogCellViewPanel.
 */
export function LogCellValue({ value, className }: { value: unknown; className?: string }) {
  const type = getValueType(value);

  if (type === 'image' && typeof value === 'string') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt="" className={cn('h-8 max-w-[120px] rounded object-cover', className)} />
    );
  }

  if (type === 'audio' && typeof value === 'string' && isHttpUrl(value)) {
    return (
      <audio
        controls
        preload="none"
        className={cn('h-8 max-w-[180px]', className)}
        src={value}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (value === null || value === undefined) {
    return <span className={cn('text-muted-foreground', className)}>—</span>;
  }

  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return (
      <span className={cn('block truncate font-mono text-[11px]', className)} title={text}>
        {text}
      </span>
    );
  }

  const text = String(value);
  const looksMarkdown =
    type === 'string' && (/^#\s|^\*\*|^\-\s|```/.test(text) || text.includes('\n'));
  return (
    <span
      className={cn('block truncate', looksMarkdown && 'text-[12px] leading-snug', className)}
      title={text}
    >
      {text}
    </span>
  );
}
