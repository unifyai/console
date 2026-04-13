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
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import type { BridgeOperation } from '@/types/assistants/bridge';
import {
  requestTileExport,
  downloadBlob,
  buildFilename,
} from '@/utils/assistants/capture-tile-html';

interface TileViewerProps {
  token: string;
  title: string;
  htmlContent: string;
  hasDataBindings: boolean;
  dataBindingsJson?: string | null;
  onDataScript?: string | null;
  embed?: boolean;
}

const BRIDGE_SCRIPT = `
<script>
(function() {
  var pending = {};
  var ready = false;
  var queued = [];

  function _flush() {
    ready = true;
    var q = queued.splice(0);
    for (var i = 0; i < q.length; i++) parent.postMessage(q[i], '*');
  }

  function _send(msg) {
    if (ready) { parent.postMessage(msg, '*'); }
    else { queued.push(msg); }
  }

  function _bridge(operation, opts) {
    return new Promise(function(resolve, reject) {
      var id = Math.random().toString(36).substr(2, 12);
      pending[id] = { resolve: resolve, reject: reject };
      var msg = { type: 'unify-data-request', id: id, operation: operation };
      for (var k in opts) { if (opts.hasOwnProperty(k)) msg[k] = opts[k]; }
      _send(msg);
    });
  }

  window.UnifyData = {
    filter: function(opts)     { return _bridge('filter', opts); },
    reduce: function(opts)     { return _bridge('reduce', opts); },
    join: function(opts)       { return _bridge('join', opts); },
    joinReduce: function(opts) { return _bridge('join_reduce', opts); }
  };

  window.addEventListener('message', function(event) {
    if (!event.data) return;
    if (event.data.type === 'unify-bridge-ready') {
      _flush();
      return;
    }
    if (event.data.type === 'unify-data-response') {
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
    if (event.data.type === 'unify-export-request') {
      var clone = document.documentElement.cloneNode(true);
      var scripts = clone.querySelectorAll('script');
      for (var s = 0; s < scripts.length; s++) {
        var txt = scripts[s].textContent || '';
        if (txt.indexOf('UnifyData') !== -1 || txt.indexOf('unify-bridge') !== -1 || txt.indexOf('unify-data-complete') !== -1) {
          scripts[s].parentNode.removeChild(scripts[s]);
        }
      }
      var origCvs = document.querySelectorAll('canvas');
      var cloneCvs = clone.querySelectorAll('canvas');
      for (var c = 0; c < cloneCvs.length; c++) {
        try {
          var im = document.createElement('img');
          im.src = origCvs[c].toDataURL('image/png');
          im.width = origCvs[c].width;
          im.height = origCvs[c].height;
          cloneCvs[c].parentNode.replaceChild(im, cloneCvs[c]);
        } catch(e) {}
      }
      parent.postMessage({
        type: 'unify-export-response',
        exportId: event.data.exportId || '',
        html: '<!DOCTYPE html>\\n' + clone.outerHTML,
        title: document.title || ''
      }, '*');
    }
  });

  parent.postMessage({ type: 'unify-bridge-init' }, '*');
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

const OPERATION_METHOD: Record<string, string> = {
  filter: 'filter',
  reduce: 'reduce',
  join: 'join',
  ['join_reduce' as const]: 'joinReduce',
};

/**
 * Build a self-executing `<script>` that calls UnifyData for each binding,
 * collects results into `{ alias: data }`, and runs the on_data callback.
 */
function buildAutoExecScript(bindingsJson: string, onDataScript: string): string {
  const bindings: Array<Record<string, unknown>> = JSON.parse(bindingsJson);
  const calls = bindings.map((b) => {
    const method = OPERATION_METHOD[b.operation as string] || 'filter';
    const alias = b.alias as string;
    const params = { ...b };
    delete params.operation;
    delete params.alias;
    return `  promises.push(window.UnifyData.${method}(${JSON.stringify(params)}).then(function(r){ results[${JSON.stringify(alias)}] = r; }));`;
  });

  return `
<script>
(function() {
  var results = {};
  var promises = [];
${calls.join('\n')}
  Promise.all(promises).then(function() {
    (function(data) { ${onDataScript} })(results);
    parent.postMessage({ type: 'unify-data-complete' }, '*');
  }).catch(function(err) {
    console.error('[UnifyData auto-exec]', err);
    parent.postMessage({ type: 'unify-data-complete' }, '*');
  });
})();
</script>`;
}

function injectAutoExec(html: string, bindingsJson: string, onDataScript: string): string {
  const bridgeHtml = injectBridge(html);
  const autoScript = buildAutoExecScript(bindingsJson, onDataScript);
  const bodyClose = bridgeHtml.lastIndexOf('</body>');
  if (bodyClose !== -1) {
    return bridgeHtml.slice(0, bodyClose) + autoScript + bridgeHtml.slice(bodyClose);
  }
  return bridgeHtml + autoScript;
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

/**
 * Orchestra grouped reduce/join-reduce results return objects like
 * `{ "Central": { "shared_value": null, "sum": 1886031.39 }, ... }`.
 * Tile on_data_scripts expect flat values: `{ "Central": 1886031.39, ... }`.
 *
 * Resolution order matches the Interfaces plot logic in lib/plotData.ts:
 *   sharedValue ?? values[metric] ?? shared_value ?? 0
 */
function flattenGroupedResult(result: unknown, metric?: string): unknown {
  if (result == null || typeof result !== 'object' || Array.isArray(result)) return result;
  const obj = result as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return result;

  const first = obj[keys[0]];
  if (first == null || typeof first !== 'object' || Array.isArray(first)) return result;

  const flat: Record<string, number> = {};
  for (const [groupKey, groupVal] of Object.entries(obj)) {
    if (groupVal != null && typeof groupVal === 'object' && !Array.isArray(groupVal)) {
      const v = groupVal as Record<string, unknown>;
      const resolved = v.sharedValue ?? (metric ? v[metric] : undefined) ?? v.shared_value ?? 0;
      flat[groupKey] = typeof resolved === 'number' ? resolved : 0;
    } else {
      flat[groupKey] = typeof groupVal === 'number' ? groupVal : 0;
    }
  }
  return flat;
}

const BRIDGE_FETCH_MS = 30_000;
const IFRAME_LOAD_FALLBACK_MS = 100_000;

export function TileViewer({
  token,
  title,
  htmlContent,
  hasDataBindings,
  dataBindingsJson,
  onDataScript,
  embed,
}: TileViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const t = window.setTimeout(() => setIsLoading(false), IFRAME_LOAD_FALLBACK_MS);
    const iframe = iframeRef.current;
    if (iframe) {
      const onLoad = () => setIsLoading(false);
      iframe.addEventListener('load', onLoad);
      return () => {
        window.clearTimeout(t);
        iframe.removeEventListener('load', onLoad);
      };
    }
    return () => window.clearTimeout(t);
  }, [htmlContent, hasDataBindings]);

  const sendBridgeReady = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'unify-bridge-ready' }, '*');
  }, []);

  const isAutoExec = !!(dataBindingsJson && onDataScript);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!event.data?.type) return;

      // Relay: parent sends export request down to inner srcdoc iframe
      if (
        embed &&
        event.data.type === 'unify-export-request' &&
        event.source !== iframeRef.current?.contentWindow
      ) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'unify-export-request', exportId: event.data.exportId || '' },
          '*'
        );
        return;
      }

      // Relay: inner iframe sends export response back up to parent, injecting the real tile title
      if (
        embed &&
        event.data.type === 'unify-export-response' &&
        event.source === iframeRef.current?.contentWindow
      ) {
        window.parent.postMessage({ ...event.data, title }, '*');
        return;
      }

      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      if (event.data.type === 'unify-data-complete') {
        setIsLoading(false);
        return;
      }

      if (event.data.type === 'unify-bridge-init') {
        if (!isAutoExec) setIsLoading(false);
        sendBridgeReady();
        return;
      }

      if (event.data.type !== 'unify-data-request') return;

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

      const ac = new AbortController();
      const to = window.setTimeout(() => ac.abort(), BRIDGE_FETCH_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ac.signal,
        });

        const responseData = await res.json();

        let unwrapped = responseData;
        if (res.ok) {
          if (op === 'reduce' || op === 'join_reduce') {
            const metric = (payload.metric ?? body.metric) as string | undefined;
            unwrapped = flattenGroupedResult(responseData.result, metric);
          } else if (op === 'filter' || op === 'join') {
            unwrapped = responseData.rows;
          }
        }

        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'unify-data-response',
            id,
            data: res.ok ? unwrapped : undefined,
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
      } finally {
        window.clearTimeout(to);
      }
    },
    [token, sendBridgeReady, isAutoExec, embed, title]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    sendBridgeReady();
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage, sendBridgeReady]);

  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadHtml = useCallback(async () => {
    const filename = buildFilename(title, token, 'html');
    if (iframeRef.current) {
      setIsExporting(true);
      try {
        const capture = await requestTileExport(iframeRef.current);
        downloadBlob(new Blob([capture.html], { type: 'text/html' }), filename);
        return;
      } catch {
        /* fall through to raw htmlContent */
      } finally {
        setIsExporting(false);
      }
    }
    downloadBlob(new Blob([htmlContent], { type: 'text/html' }), filename);
  }, [title, token, htmlContent]);

  const handleIframeLoad = useCallback(() => setIsLoading(false), []);

  const processedHtml = (() => {
    if (dataBindingsJson && onDataScript) {
      return injectAutoExec(htmlContent, dataBindingsJson, onDataScript);
    }
    return injectBridge(htmlContent);
  })();

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
        <Button
          variant="outline"
          size="sm"
          className="ml-4 h-7 shrink-0 gap-1.5 text-xs"
          disabled={isExporting}
          onClick={handleDownloadHtml}
        >
          {isExporting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Download
        </Button>
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
