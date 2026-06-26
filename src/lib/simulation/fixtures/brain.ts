/**
 * Brain fixtures backing the Contacts/Transcripts/Knowledge/Guidance/Functions
 * panes. Each entry is a generic row the table view can render.
 */

import type { MockBrainEntry } from '../types';

let nextId = 9000;
function id(): number {
  return ++nextId;
}

export const brainEntries: MockBrainEntry[] = [
  {
    id: id(),
    section: 'Contacts',
    createdAt: '2026-01-10T10:00:00.000Z',
    fields: {
      name: 'Jordan Blake',
      email: 'jordan@example.com',
      phone: '+1 555 0101',
      relationship: 'Investor',
      notes: 'Prefers email; follow up after the next demo.',
    },
  },
  {
    id: id(),
    section: 'Contacts',
    createdAt: '2026-01-11T14:30:00.000Z',
    fields: {
      name: 'Priya Nair',
      email: 'priya@acme.example',
      phone: '+44 20 7946 0000',
      relationship: 'Customer',
      notes: 'Renewal in March.',
    },
  },
  {
    id: id(),
    section: 'Transcripts',
    createdAt: '2026-01-12T16:05:00.000Z',
    fields: {
      channel: 'Phone',
      participant: 'Jordan Blake',
      summary: 'Discussed Series A timeline and product roadmap.',
      durationSeconds: 612,
    },
  },
  {
    id: id(),
    section: 'Knowledge',
    createdAt: '2026-01-08T09:15:00.000Z',
    fields: {
      title: 'Brand voice guidelines',
      source: 'uploaded.pdf',
      tags: 'brand, writing',
      excerpt: 'Warm, concise, never over-promises.',
    },
  },
  {
    id: id(),
    section: 'Guidance',
    createdAt: '2026-01-09T11:45:00.000Z',
    fields: {
      title: 'Escalation policy',
      detail: 'Loop in a human for refunds over $500.',
      priority: 'High',
    },
  },
  {
    id: id(),
    section: 'Functions',
    createdAt: '2026-01-07T08:00:00.000Z',
    fields: {
      name: 'create_calendar_event',
      description: 'Schedules a meeting on the shared calendar.',
      enabled: true,
    },
  },
];

/** A scenario with no brain rows yet, to exercise empty states. */
export const emptyBrainEntries: MockBrainEntry[] = [];
