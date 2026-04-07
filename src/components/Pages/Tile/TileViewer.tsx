/**
 * TileViewer Component
 *
 * Renders a self-contained HTML tile in a sandboxed iframe using srcdoc.
 * For tiles with data bindings, injects a bridge script that provides
 * UnifyData.query() inside the iframe. The parent listens for postMessage
 * requests and proxies them through the Console's data bridge API route.
 */

'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TileViewerProps {
  token: string;
  title: string;
  htmlContent: string;
  hasDataBindings: boolean;
  embed?: boolean;
}

const BRIDGE_SCRIPT = `
<script>
(function() {
  var pending = {};
  window.UnifyData = {
    query: function(opts) {
      return new Promise(function(resolve, reject) {
        var id = Math.random().toString(36).substr(2, 12);
        pending[id] = { resolve: resolve, reject: reject };
        parent.postMessage({
          type: 'unify-data-request',
          id: id,
          context: opts.context,
          filter: opts.filter,
          columns: opts.columns,
          exclude_columns: opts.exclude_columns,
          order_by: opts.order_by,
          descending: opts.descending,
          sorting: opts.sorting,
          limit: opts.limit,
          offset: opts.offset,
          group_by: opts.group_by,
          column_context: opts.column_context,
          randomize: opts.randomize
        }, '*');
      });
    }
  };
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'unify-data-response') {
      var handler = pending[event.data.id];
      if (handler) {
        delete pending[event.data.id];
        if (event.data.error) {
          handler.reject(new Error(event.data.error));
        } else {
          handler.resolve(event.data.data);
        }
      }
    }
  });
})();
</script>
`;

function injectBridge(html: string): string {
  const headClose = html.indexOf('</head>');
  if (headClose !== -1) {
    return html.slice(0, headClose) + BRIDGE_SCRIPT + html.slice(headClose);
  }
  const bodyOpen = html.indexOf('<body');
  if (bodyOpen !== -1) {
    const bodyTagEnd = html.indexOf('>', bodyOpen);
    if (bodyTagEnd !== -1) {
      return html.slice(0, bodyTagEnd + 1) + BRIDGE_SCRIPT + html.slice(bodyTagEnd + 1);
    }
  }
  return BRIDGE_SCRIPT + html;
}

export function TileViewer({ token, title, htmlContent, hasDataBindings, embed }: TileViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type !== 'unify-data-request') return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      const {
        id,
        context,
        filter,
        columns,
        exclude_columns: excludeColumns,
        order_by: orderBy,
        descending,
        sorting,
        limit,
        offset,
        group_by: groupBy,
        column_context: columnContext,
        randomize,
      } = event.data;

      try {
        const res = await fetch(`/api/dashboards/tiles/${token}/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            filter,
            columns,
            excludeColumns,
            orderBy,
            descending,
            sorting,
            limit,
            offset,
            groupBy,
            columnContext,
            randomize,
          }),
        });

        const responseData = await res.json();

        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'unify-data-response',
            id,
            data: res.ok ? responseData : undefined,
            error: res.ok ? undefined : responseData.error || 'Data fetch failed',
          },
          '*'
        );
      } catch (err) {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'unify-data-response',
            id,
            error: err instanceof Error ? err.message : 'Bridge error',
          },
          '*'
        );
      }
    },
    [token]
  );

  useEffect(() => {
    if (!hasDataBindings) return;
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [hasDataBindings, handleMessage]);

  const handleIframeLoad = useCallback(() => setIsLoading(false), []);

  const processedHtml = hasDataBindings ? injectBridge(htmlContent) : htmlContent;

  if (embed) {
    return (
      <div className="relative h-screen w-full">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={processedHtml}
          className="h-full w-full border-0"
          title={title}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleIframeLoad}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-title text-semibold text-foreground">{title}</h1>
      </header>
      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-body-muted">Loading tile...</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={processedHtml}
          className="h-full w-full border-0"
          title={title}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}
