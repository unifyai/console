/**
 * DrawerPinnedSection - Displays pinned datapoints in the drawer
 *
 * Shows each pinned datapoint with its X, Y, and optional group values.
 * Supports unpinning, copying values, and bidirectional hover highlighting.
 */

'use client';

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import {
  DrawerPinnedSectionProps,
  PinnedDatapoint,
  OnHighlightRequest,
} from '@/types/interfaces/plot-details';

/**
 * Single pinned datapoint card
 */
function PinnedCard({
  datapoint,
  onUnpin,
  onCopy,
  onHighlight,
}: {
  datapoint: PinnedDatapoint;
  onUnpin?: (id: string) => void;
  onCopy?: (value: string | number) => void;
  onHighlight?: OnHighlightRequest;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (field: string, value: string | number) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
      onCopy?.(value);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className="bg-muted/20 hover:bg-muted/40 flex cursor-pointer flex-col gap-1 rounded-md border border-border p-2 transition-colors"
      onMouseEnter={() => onHighlight?.({ type: 'datapoint', datapointId: datapoint.id })}
      onMouseLeave={() => onHighlight?.({ type: 'none' })}
    >
      {/* Header with unpin button */}
      <div className="flex items-center justify-between">
        <span className="text-label text-muted-foreground">Pinned Datapoint</span>
        {onUnpin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnpin(datapoint.id);
            }}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Unpin datapoint"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Group value (if present) */}
      {datapoint.group && (
        <DataRow
          label={datapoint.group.label}
          value={datapoint.group.value}
          onCopy={() => handleCopy('group', datapoint.group!.value)}
          isCopied={copiedField === 'group'}
        />
      )}

      {/* X value */}
      <DataRow
        label={datapoint.x.label}
        value={datapoint.x.value}
        onCopy={() => handleCopy('x', datapoint.x.value)}
        isCopied={copiedField === 'x'}
      />

      {/* Y value */}
      <DataRow
        label={datapoint.y.label}
        value={datapoint.y.value}
        onCopy={() => handleCopy('y', datapoint.y.value)}
        isCopied={copiedField === 'y'}
      />
    </div>
  );
}

/**
 * Single data row with label, value, and copy button
 */
function DataRow({
  label,
  value,
  onCopy,
  isCopied,
}: {
  label: string;
  value: string | number;
  onCopy: () => void;
  isCopied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 overflow-hidden">
        <span className="text-caption">{label}</span>
        <p className="text-title truncate text-foreground">{String(value)}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Copy ${label}`}
      >
        {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

/**
 * DrawerPinnedSection Component
 *
 * Renders the pinned datapoints section of the PlotDetailsDrawer.
 * Hovering on a pinned card highlights the corresponding bar/point in the plot.
 */
export function DrawerPinnedSection({
  pinnedDatapoints,
  onUnpin,
  onCopy,
  onHighlight,
}: DrawerPinnedSectionProps) {
  if (pinnedDatapoints.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label text-semibold uppercase tracking-wide text-muted-foreground">
        Pinned ({pinnedDatapoints.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {pinnedDatapoints.map((datapoint) => (
          <PinnedCard
            key={datapoint.id}
            datapoint={datapoint}
            onUnpin={onUnpin}
            onCopy={onCopy}
            onHighlight={onHighlight}
          />
        ))}
      </div>
    </section>
  );
}

export default DrawerPinnedSection;
