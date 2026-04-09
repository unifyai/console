/**
 * TileViewer Component
 *
 * Renders a self-contained HTML tile in a sandboxed iframe using srcdoc.
 * For tiles with data bindings, injects a bridge script that provides
 * UnifyData.filter/reduce/join/joinReduce inside the iframe. The parent
 * listens for postMessage requests and proxies them through the Console's
 * bridge API routes, one per operation type.
 */

'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BridgeOperation } from '@/types/assistants/bridge';

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
  function _bridge(operation, opts) {
    return new Promise(function(resolve, reject) {
      var id = Math.random().toString(36).substr(2, 12);
      pending[id] = { resolve: resolve, reject: reject };
      var msg = { type: 'unify-data-request', id: id, operation: operation };
      for (var k in opts) { if (opts.hasOwnProperty(k)) msg[k] = opts[k]; }
      parent.postMessage(msg, '*');
    });
  }
  window.UnifyData = {
    filter: function(opts)     { return _bridge('filter', opts); },
    reduce: function(opts)     { return _bridge('reduce', opts); },
    join: function(opts)       { return _bridge('join', opts); },
    joinReduce: function(opts) { return _bridge('join_reduce', opts); }
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

/**
 * Map snake_case iframe payload fields to camelCase for the Console proxy.
 * Filter operation retains the legacy field mapping; new operations pass
 * through with camelCase keys the proxy routes expect.
 */
function buildProxyBody(
  op: BridgeOperation,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (op === 'filter') {
    return {
      context: payload.context,
      filter: payload.filter,
      columns: payload.columns,
      excludeColumns: payload.exclude_columns,
      orderBy: payload.order_by,
      descending: payload.descending,
      sorting: payload.sorting,
      limit: payload.limit,
      offset: payload.offset,
      groupBy: payload.group_by,
      columnContext: payload.column_context,
      randomize: payload.randomize,
    };
  }

  if (op === 'reduce') {
    return {
      context: payload.context,
      metric: payload.metric,
      columns: payload.columns,
      filter: payload.filter,
      groupBy: payload.group_by,
      resultWhere: payload.result_where,
    };
  }

  if (op === 'join') {
    return {
      tables: payload.tables,
      joinExpr: payload.join_expr,
      select: payload.select,
      mode: payload.mode,
      leftWhere: payload.left_where,
      rightWhere: payload.right_where,
      resultWhere: payload.result_where,
      resultLimit: payload.result_limit,
      resultOffset: payload.result_offset,
    };
  }

  // join_reduce
  return {
    tables: payload.tables,
    joinExpr: payload.join_expr,
    select: payload.select,
    mode: payload.mode,
    leftWhere: payload.left_where,
    rightWhere: payload.right_where,
    metric: payload.metric,
    columns: payload.columns,
    groupBy: payload.group_by,
    resultWhere: payload.result_where,
  };
}

export function TileViewer({ token, title, htmlContent, hasDataBindings, embed }: TileViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type !== 'unify-data-request') return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      const { id, operation, ...payload } = event.data as {
        id: string;
        operation: BridgeOperation;
        [key: string]: unknown;
      };
      delete (payload as Record<string, unknown>).type;

      const op: BridgeOperation = operation || 'filter';

      const routeSegment: Record<BridgeOperation, string> = {
        filter: 'filter',
        reduce: 'reduce',
        join: 'join',
        ['join_reduce' as const]: 'join-reduce',
      };

      const url = `/api/dashboards/tiles/${token}/${routeSegment[op]}`;
      const body = buildProxyBody(op, payload);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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
