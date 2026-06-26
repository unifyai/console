/**
 * Brain handler backing the Contacts/Transcripts/Knowledge/Guidance/Functions
 * panes via `/v0/logs`. The `context` query param ends with the section name;
 * rows are returned in the `{ logs: [{ entries }], count }` envelope the brain
 * client parses.
 */

import type { SimContext, SimHandler } from '../dispatch';
import { getSession } from '../store';

const KNOWN_SECTIONS = ['Contacts', 'Transcripts', 'Knowledge', 'Guidance', 'Functions', 'Tasks'];

function sectionFromContext(context: string | null): string | null {
  if (!context) return null;
  const segments = context.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (KNOWN_SECTIONS.includes(segments[i])) return segments[i];
  }
  return segments[segments.length - 1] ?? null;
}

const logs: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/logs',
  handle: (ctx: SimContext) => {
    const section = sectionFromContext(ctx.searchParams.get('context'));
    const limit = Number(ctx.searchParams.get('limit') ?? '50');
    const offset = Number(ctx.searchParams.get('offset') ?? '0');

    const { brain } = getSession(ctx.scenario.id);
    const matching = brain.filter((e) => e.section === section);
    const page = matching.slice(offset, offset + limit);

    return {
      json: {
        logs: page.map((entry) => ({
          id: entry.id,
          entries: { ...entry.fields, timestamp: entry.createdAt },
        })),
        count: matching.length,
      },
    };
  },
};

const logsFields: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/logs/fields',
  handle: () => ({ json: [] }),
};

const logsLatestTimestamp: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/logs/latest_timestamp',
  handle: () => ({ json: { latestTimestamp: null } }),
};

export const brainHandlers: SimHandler[] = [logs, logsFields, logsLatestTimestamp];
