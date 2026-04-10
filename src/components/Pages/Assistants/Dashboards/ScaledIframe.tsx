'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';

const DEFAULT_ZOOM = 0.75;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

interface ScaledIframeProps {
  htmlContent: string;
  title: string;
  /** Initial zoom level (default 0.75). Uses CSS transform for uniform scaling. */
  initialZoom?: number;
  showZoomControls?: boolean;
  className?: string;
}

/**
 * Renders tile HTML inside an iframe using CSS `transform: scale()`.
 *
 * The iframe is sized to `(1/zoom × 100%)` of the container then scaled
 * back down, so charts, text, and every other element scale uniformly.
 * CSS `zoom` can't do this because it changes the effective viewport,
 * causing responsive charts to re-render at the new virtual size.
 */
export function ScaledIframe({
  htmlContent,
  title,
  initialZoom = DEFAULT_ZOOM,
  showZoomControls = false,
  className,
}: ScaledIframeProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => setIsLoading(false), []);

  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100)),
    []
  );
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100)),
    []
  );
  const zoomReset = useCallback(() => setZoom(initialZoom), [initialZoom]);

  const zoomPercent = Math.round(zoom * 100);
  const inverseScale = (1 / zoom) * 100;

  return (
    <div className={cn('relative flex h-full flex-col', className)}>
      {showZoomControls && (
        <div className="border-border/50 bg-background/90 absolute right-4 top-2 z-20 flex items-center gap-0.5 rounded-md border px-0.5 py-0.5 shadow-sm backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="min-w-[32px] select-none text-center text-[10px] tabular-nums text-muted-foreground">
            {zoomPercent}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          {zoom !== initialZoom && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={zoomReset}
              title="Reset zoom"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className="absolute left-0 top-0 border-0"
          style={{
            width: `${inverseScale}%`,
            height: `${inverseScale}%`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          title={title}
          sandbox="allow-scripts"
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
}
