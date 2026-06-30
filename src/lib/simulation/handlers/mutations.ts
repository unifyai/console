/**
 * Visible brain mutations routed through the in-session store so create / edit /
 * delete feel real within a session (and reset on reload). Covers the
 * `POST/PUT/DELETE /v0/logs` shapes the brain server actions emit
 * (Contacts, Knowledge, Guidance, Secrets, …) plus a task "run now" echo.
 *
 * Bodies arrive snake_case (the Orchestra client converts request bodies on the
 * way out); GET reads convert back to camelCase, so storing rows verbatim is
 * safe and idempotent.
 */

import type { SimContext, SimHandler } from '../dispatch';
import { addRow, deleteRow, updateRowByLogId } from '../store';
import { tablePathFromContext } from './context-util';
import type { MockRow } from '../types';

/** Drops Orchestra-private (`_`-prefixed) keys so stored rows stay display-clean. */
function stripPrivate(entry: MockRow): MockRow {
  const out: MockRow = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith('_')) out[key] = value;
  }
  return out;
}

const logsCreate: SimHandler = {
  match: (method, pathname) => method === 'POST' && pathname === '/v0/logs',
  handle: (ctx: SimContext) => {
    const body = (ctx.body ?? {}) as {
      context?: string;
      entries?: MockRow[] | MockRow;
    };
    const tablePath = tablePathFromContext(body.context ?? null);
    if (!tablePath || !body.entries) return { json: { success: true } };
    const entries = Array.isArray(body.entries) ? body.entries : [body.entries];
    for (const entry of entries) {
      addRow(ctx.scenario.id, tablePath, stripPrivate(entry));
    }
    return { json: { success: true, count: entries.length } };
  },
};

const logsUpdate: SimHandler = {
  match: (method, pathname) => method === 'PUT' && pathname === '/v0/logs',
  handle: (ctx: SimContext) => {
    const body = (ctx.body ?? {}) as { logs?: number[]; entries?: MockRow };
    if (body.logs && body.entries) {
      for (const logId of body.logs) {
        updateRowByLogId(ctx.scenario.id, logId, stripPrivate(body.entries));
      }
    }
    return { json: { success: true } };
  },
};

const logsDelete: SimHandler = {
  match: (method, pathname) => method === 'DELETE' && pathname === '/v0/logs',
  handle: (ctx: SimContext) => {
    const body = (ctx.body ?? {}) as Record<string, unknown> & {
      context?: string;
      idsAndFields?: Array<[number, unknown]>;
    };
    const tablePath = tablePathFromContext(body.context ?? null);
    const pairs =
      body.idsAndFields ?? (body['ids_and_fields'] as Array<[number, unknown]> | undefined) ?? [];
    if (tablePath) {
      for (const [logId] of pairs) {
        deleteRow(ctx.scenario.id, tablePath, logId);
      }
    }
    return { json: { success: true } };
  },
};

export const mutationHandlers: SimHandler[] = [logsCreate, logsUpdate, logsDelete];
