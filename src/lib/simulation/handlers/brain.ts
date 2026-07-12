/**
 * Context-aware `/v0/logs` handler — the single seam nearly every read surface
 * funnels through (Contacts, Transcripts, Knowledge claim ledger,
 * Guidance, Tasks + Runs, Actions events, Dashboards, Secrets, and the Data
 * browser). The `context` query param is the full Orchestra path
 * (`{userId}/{agentId}/{Table}` or `Teams/{teamId}/{Table}`); we strip the
 * prefix to the table path the store is keyed by, apply the handful of filter
 * cases that gate UX, then return the `{ logs: [{ id, ts, entries }], count }`
 * envelope the clients parse. Entries are camelCase (eslint forbids snake_case
 * keys; the response pipeline is idempotent for camelCase; the UI reads
 * camelCase).
 */

import type { SimContext, SimHandler } from '../dispatch';
import { getTable, rowLogId } from '../store';
import type { MockRow } from '../types';
import { firstQuotedLiteral, parseSorting, tablePathFromContext } from './context-util';

interface IdRow {
  id: number;
  entries: MockRow;
}

/** Resolves the store table path for a request, honouring the project prefix. */
function resolveTablePath(ctx: SimContext): string | null {
  const context = ctx.searchParams.get('context');
  const projectName = ctx.searchParams.get('projectName');
  return projectName && projectName !== 'Assistants' ? context : tablePathFromContext(context);
}

function applyFilter(rows: IdRow[], tablePath: string, filterExpr: string | null): IdRow[] {
  if (!filterExpr) return rows;

  // Tasks "running" gate — return rows whose run state is still active.
  if (/state\s*==\s*["']running["']/.test(filterExpr)) {
    return rows.filter((r) => r.entries.state === 'running');
  }

  // Chat contact resolution by email → return the matching contact (or the
  // first non-system contact) so the optimistic chat flow has a contactId.
  if (tablePath.endsWith('Contacts') && /email_address\s*==/.test(filterExpr)) {
    const email = firstQuotedLiteral(filterExpr);
    const match = rows.find((r) => r.entries.emailAddress === email);
    if (match) return [match];
    const firstHuman = rows.find((r) => r.entries.isSystem !== true);
    return firstHuman ? [firstHuman] : rows.slice(0, 1);
  }

  // Transcript medium gating (chat history vs call pills).
  if (tablePath.endsWith('Transcripts')) {
    const mediumMatch = filterExpr.match(/medium\s*==\s*["']([^"']+)["']/);
    if (mediumMatch) {
      const medium = mediumMatch[1];
      return rows.filter((r) => r.entries.medium === medium);
    }
  }

  // Knowledge claim lifecycle filter (default active ledger view).
  // Applied as a narrowing step so it composes with other filter clauses.
  if (tablePath === 'Knowledge' || tablePath.endsWith('/Knowledge')) {
    const statusMatch = filterExpr.match(/status\s*==\s*["']([^"']+)["']/);
    if (statusMatch) {
      const status = statusMatch[1];
      rows = rows.filter((r) => String(r.entries.status ?? 'active') === status);
    }
  }

  // Actions: roots only (`len(hierarchy) == 1`).
  if (tablePath.endsWith('ManagerMethod') && /len\(hierarchy\)\s*==\s*1/.test(filterExpr)) {
    return rows.filter((r) => (r.entries.hierarchy as unknown[])?.length === 1);
  }

  // ToolLoop steps are fetched per action node via
  // `hierarchy_label.startswith('<calling-id path>')`. The hosted backend keys
  // this on the calling-id hierarchy, so we match on the unambiguous
  // `hierarchy` array (e.g. ['act-002']) to avoid cross-contaminating one
  // action's steps onto another's expanded card.
  if (tablePath.endsWith('ToolLoop')) {
    const prefixMatch = filterExpr.match(/hierarchy_label\.startswith\(\s*["']([^"']+)["']\s*\)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      return rows.filter((r) => {
        const hierarchy = r.entries.hierarchy as unknown[] | undefined;
        const joined = Array.isArray(hierarchy) ? hierarchy.join('->') : '';
        return joined === prefix || joined.startsWith(`${prefix}->`);
      });
    }
  }

  return rows;
}

function sortValue(row: MockRow, field: string): number | string {
  const value = row[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return '';
}

const logs: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/logs',
  handle: (ctx: SimContext) => {
    const tablePath = resolveTablePath(ctx);
    if (!tablePath) return { json: { logs: [], count: 0 } };

    const limit = Number(ctx.searchParams.get('limit') ?? '50');
    const offset = Number(ctx.searchParams.get('offset') ?? '0');
    const filterExpr = ctx.searchParams.get('filter_expr') || ctx.searchParams.get('filterExpr');
    const sorting = parseSorting(ctx.searchParams.get('sorting'));

    const table = getTable(ctx.scenario.id, tablePath);
    let rows: IdRow[] = table.map((entries, index) => ({
      id: rowLogId(tablePath, index, entries),
      entries,
    }));

    rows = applyFilter(rows, tablePath, filterExpr);

    if (sorting) {
      const dir = sorting.direction === 'ascending' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = sortValue(a.entries, sorting.field);
        const bv = sortValue(b.entries, sorting.field);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    const count = rows.length;
    const page = rows.slice(offset, offset + limit);

    return {
      json: {
        logs: page.map(({ id, entries }) => ({
          id,
          ts:
            (entries.timestamp as string) ??
            (entries.updatedAt as string) ??
            (entries.observedAt as string) ??
            (entries.createdAt as string) ??
            (entries.eventTimestamp as string) ??
            null,
          entries,
        })),
        count,
      },
    };
  },
};

const logsFields: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/logs/fields',
  handle: (ctx: SimContext) => {
    const tablePath = resolveTablePath(ctx);
    if (!tablePath) return { json: [] };
    const table = getTable(ctx.scenario.id, tablePath);
    const fields = new Set<string>();
    table.forEach((row) => Object.keys(row).forEach((k) => fields.add(k)));
    return { json: Array.from(fields) };
  },
};

const logsLatestTimestamp: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/logs/latest_timestamp',
  handle: () => ({ json: { latestTimestamp: null } }),
};

// Metric aggregations (e.g. integrations catalog count). Returns a row count so
// faceted totals render a sensible number instead of erroring.
const logsMetric: SimHandler = {
  match: (method, pathname) => method === 'GET' && /^\/v0\/logs\/metric\/[^/]+$/.test(pathname),
  handle: (ctx: SimContext) => {
    const tablePath = resolveTablePath(ctx);
    const count = tablePath ? getTable(ctx.scenario.id, tablePath).length : 0;
    return { json: count };
  },
};

export const brainHandlers: SimHandler[] = [logs, logsFields, logsLatestTimestamp, logsMetric];
