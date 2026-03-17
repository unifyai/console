/**
 * Inline Embed Components for Chat
 *
 * Detects and renders Unify table/plot URLs as interactive inline embeds
 * within chat messages instead of plain links.
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ExternalLink, Table2, BarChart3, Maximize2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';

// =============================================================================
// Types
// =============================================================================

interface EmbedProps {
  url: string;
  token: string;
  type: 'table' | 'plot';
}

interface ParsedEmbed {
  type: 'table' | 'plot';
  token: string;
  url: string;
}

// =============================================================================
// URL Parsing
// =============================================================================

/**
 * Pattern to match table view URLs
 * Matches: /table/view/{token} or full URLs
 */
const TABLE_URL_PATTERN = /(?:https?:\/\/[^/]+)?\/table\/view\/([a-zA-Z0-9_-]+)/;

/**
 * Pattern to match plot view URLs
 * Matches: /plot/view/{token} or full URLs
 */
const PLOT_URL_PATTERN = /(?:https?:\/\/[^/]+)?\/plot\/view\/([a-zA-Z0-9_-]+)/;

/**
 * Parse a URL to check if it's an embeddable table or plot
 */
export function parseEmbedUrl(url: string): ParsedEmbed | null {
  const tableMatch = url.match(TABLE_URL_PATTERN);
  if (tableMatch) {
    return {
      type: 'table',
      token: tableMatch[1],
      url,
    };
  }

  const plotMatch = url.match(PLOT_URL_PATTERN);
  if (plotMatch) {
    return {
      type: 'plot',
      token: plotMatch[1],
      url,
    };
  }

  return null;
}

/**
 * Check if a string contains embeddable URLs
 */
export function containsEmbedUrl(text: string): boolean {
  return TABLE_URL_PATTERN.test(text) || PLOT_URL_PATTERN.test(text);
}

// =============================================================================
// Inline Preview Component (Compact)
// =============================================================================

interface InlineEmbedPreviewProps {
  embed: ParsedEmbed;
  onExpand?: () => void;
  className?: string;
}

/**
 * Compact inline preview card for embeds
 * Shows a mini preview with expand option
 */
export function InlineEmbedPreview({ embed, onExpand, className }: InlineEmbedPreviewProps) {
  const Icon = embed.type === 'table' ? Table2 : BarChart3;
  const label = embed.type === 'table' ? 'Interactive Table' : 'Interactive Chart';

  return (
    <div
      className={cn(
        'bg-muted/30 hover:bg-muted/50 group my-2 flex items-center gap-3 rounded-lg border border-border p-3 transition-colors',
        className
      )}
    >
      <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
        <Icon className="h-5 w-5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-caption truncate">{embed.token}</div>
      </div>

      <div className="flex shrink-0 gap-1">
        {onExpand && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="h-8 w-8 p-0"
            title="Expand inline"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0" title="Open in new tab">
          <a href={embed.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Expanded Inline Embed (Full Interactive)
// =============================================================================

interface InlineEmbedExpandedProps {
  embed: ParsedEmbed;
  onCollapse?: () => void;
  height?: number;
  className?: string;
}

/**
 * Expanded inline embed with full interactivity via iframe
 * Falls back to the full page for complete functionality
 */
export function InlineEmbedExpanded({
  embed,
  onCollapse,
  height = 400,
  className,
}: InlineEmbedExpandedProps) {
  const Icon = embed.type === 'table' ? Table2 : BarChart3;
  const label = embed.type === 'table' ? 'Interactive Table' : 'Interactive Chart';
  const [isLoading, setIsLoading] = useState(true);
  const [iframeActive, setIframeActive] = useState(false);

  const handleIframeLoad = useCallback(() => setIsLoading(false), []);

  // Always use a local path so the iframe loads from the same origin,
  // avoiding cross-origin framing blocks when the chat message contains
  // a full URL pointing to a different environment (e.g. staging).
  const iframeSrc = useMemo(
    () => `/${embed.type}/view/${embed.token}`,
    [embed.type, embed.token]
  );

  const iframeScale = embed.type === 'table' ? 0.92 : 1;
  const scaledHeight = Math.round(height / iframeScale);
  const scaledWidth = iframeScale < 1 ? `${Math.round(100 / iframeScale)}%` : '100%';

  return (
    <div
      className={cn(
        'my-2 overflow-hidden rounded-lg border border-border bg-background shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="bg-muted/30 flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-title">{label}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0" title="Open in new tab">
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          {onCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapse}
              className="h-7 w-7 p-0"
              title="Collapse"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Iframe Content */}
      {/* Click to activate: pointer-events on iframe are disabled until clicked,
          so parent chat scroll works uninterrupted when cursor passes over the embed. */}
      <div
        style={{ height }}
        className="relative overflow-hidden"
        onClick={() => setIframeActive(true)}
        onMouseLeave={() => setIframeActive(false)}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-caption text-muted-foreground">Loading {embed.type}...</span>
            </div>
          </div>
        )}
        <iframe
          src={iframeSrc}
          className="border-0"
          style={{
            width: scaledWidth,
            height: scaledHeight,
            transform: iframeScale < 1 ? `scale(${iframeScale})` : undefined,
            transformOrigin: 'top left',
            pointerEvents: iframeActive ? 'auto' : 'none',
          }}
          title={label}
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Smart Inline Embed (Toggleable)
// =============================================================================

interface InlineEmbedProps {
  embed: ParsedEmbed;
  defaultExpanded?: boolean;
  expandedHeight?: number;
  className?: string;
}

/**
 * Smart embed component that toggles between preview and expanded states
 */
export function InlineEmbed({
  embed,
  defaultExpanded = false,
  expandedHeight = 400,
  className,
}: InlineEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (isExpanded) {
    return (
      <InlineEmbedExpanded
        embed={embed}
        onCollapse={() => setIsExpanded(false)}
        height={expandedHeight}
        className={className}
      />
    );
  }

  return (
    <InlineEmbedPreview embed={embed} onExpand={() => setIsExpanded(true)} className={className} />
  );
}

// =============================================================================
// Content Renderer with Embed Detection
// =============================================================================

interface RenderContentWithEmbedsProps {
  content: string;
  defaultExpanded?: boolean;
  expandedHeight?: number;
}

/**
 * Renders text content, detecting and embedding table/plot URLs inline
 * while rendering other URLs as regular links
 */
export function RenderContentWithEmbeds({
  content,
  defaultExpanded = false,
  expandedHeight = 400,
}: RenderContentWithEmbedsProps) {
  // Split content by URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part is a URL
        if (part.match(urlRegex)) {
          const embed = parseEmbedUrl(part);

          // If it's an embeddable URL, render inline embed
          if (embed) {
            return (
              <InlineEmbed
                key={index}
                embed={embed}
                defaultExpanded={defaultExpanded}
                expandedHeight={expandedHeight}
              />
            );
          }

          // Otherwise render as regular link
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }

        // Regular text
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

// =============================================================================
// Exports
// =============================================================================

export type { ParsedEmbed, EmbedProps };
