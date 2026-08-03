/**
 * Canvas fixtures for mock simulation mode.
 *
 * Server-only. The bundle below is a real ES module: the runtime host imports it
 * from a `blob:` URL and resolves `react` and `@unity/canvas-kit` through its own
 * import map, exactly as it does for an actor-authored canvas. That is the point of
 * shipping working code here rather than a placeholder — the thing under inspection
 * in mock mode is the whole path, including the frame handshake, a binding answered
 * over the port, an action requiring confirmation, and the run history that follows.
 *
 * It is written with `React.createElement` rather than JSX because a fixture must
 * not need a build step. An authored canvas is TSX compiled by the toolchain; the
 * module that reaches the frame looks like this either way.
 *
 * The bundle's sha is pinned below rather than hashed here, so the integrity check
 * in `fetchCanvasRecord` runs for real in mock mode instead of being bypassed. It
 * cannot be computed at load: the simulation handlers are reachable from the client
 * bundle through the Orchestra clients' top-level `simulationFetch` import, and
 * `node:crypto` has no browser resolution — importing it fails the build outright.
 * `canvasMockMode.node.test.ts` recomputes the hash and fails if the two drift.
 */

/** Token for the seeded canvas. Twelve URL-safe characters, like a real one. */
export const MOCK_CANVAS_TOKEN = 'mockCanvas01';

/** Binding alias the canvas reads its rows under. */
export const MOCK_CANVAS_ALIAS = 'openTasks';

/** Action the canvas can trigger. Confirmation is required, so the dialog shows. */
export const MOCK_CANVAS_ACTION = 'send_reminders';

/**
 * The compiled module, as it would arrive from the authoring pipeline.
 *
 * Deliberately exercises the four things worth seeing: a materialised prop, rows
 * arriving asynchronously over the port, an action whose confirmation is handled
 * outside the frame, and the result reported back into the canvas afterwards.
 */
export const MOCK_CANVAS_BUNDLE = `import React from 'react';
import {
  ActionButton,
  ActionResult,
  Canvas,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Heading,
  Row,
  Stack,
  Table,
  Text,
} from '@unity/canvas-kit';

const h = React.createElement;

const COLUMNS = [
  { key: 'title', header: 'Task' },
  { key: 'owner', header: 'Owner' },
  { key: 'due', header: 'Due' },
  { key: 'status', header: 'Status', align: 'right' },
];

export default function MockTracker({ canvas }) {
  const rows = canvas.data['${MOCK_CANVAS_ALIAS}'];

  React.useEffect(() => {
    canvas.requestData('${MOCK_CANVAS_ALIAS}');
  }, []);

  const pending = Array.isArray(rows) ? rows.filter((row) => row.status !== 'done') : [];
  const owners = Array.from(new Set(pending.map((row) => row.owner)));

  return h(
    Canvas,
    null,
    h(
      Stack,
      { gap: 'lg' },
      h(
        Row,
        { justify: 'between', align: 'end' },
        h(
          Stack,
          { gap: 'xs' },
          h(Heading, { level: 2 }, 'Open tasks'),
          h(
            Text,
            { tone: 'muted' },
            rows === undefined
              ? 'Loading…'
              : pending.length + ' open across ' + owners.length + ' owners',
          ),
        ),
        h(Text, { tone: 'muted' }, 'Synced ' + String(canvas.props.syncedAt ?? 'just now')),
      ),
      h(
        Card,
        null,
        h(CardHeader, null, h(CardTitle, null, 'Everything still outstanding')),
        h(
          CardContent,
          null,
          h(Table, {
            columns: COLUMNS,
            rows: pending,
            rowKey: (row, index) => String(row.title ?? index),
            emptyMessage: rows === undefined ? 'Loading tasks…' : 'Nothing outstanding.',
          }),
        ),
      ),
      h(
        Stack,
        { gap: 'sm' },
        h(ActionButton, {
          canvas,
          action: '${MOCK_CANVAS_ACTION}',
          args: { recipients: owners, note: 'Weekly nudge on open tasks' },
        }),
        h(ActionResult, {
          canvas,
          action: '${MOCK_CANVAS_ACTION}',
          successMessage: 'Reminders sent.',
        }),
      ),
    ),
  );
}
`;

/**
 * Content address of the bundle above, so the real integrity check passes.
 *
 * Edit the bundle and this must be updated with it — the test recomputes the hash
 * and prints the correct value on failure.
 */
export const MOCK_CANVAS_BUNDLE_SHA =
  '8f4937ea1eec44006dda8f7f7cf4070200fd23e18cf3a4f7972fe92be953e7cf';

/** Rows the binding resolves to, standing in for a `primitives.tasks` filter. */
export const MOCK_CANVAS_ROWS: Array<Record<string, unknown>> = [
  { title: 'Renew the Riverside housing contract', owner: 'Priya', due: 'Fri', status: 'open' },
  { title: 'Chase the Q3 invoice from Northwind', owner: 'Sam', due: 'Mon', status: 'blocked' },
  { title: 'Draft the board update', owner: 'Priya', due: 'Wed', status: 'open' },
  { title: 'Archive the old telematics export', owner: 'Alex', due: 'Thu', status: 'done' },
];

/** The action as the frame is allowed to see it. Targets are never included. */
export const MOCK_CANVAS_ACTION_DESCRIPTOR = {
  name: MOCK_CANVAS_ACTION,
  label: 'Send reminders',
  icon: null,
  inputSchema: {
    type: 'object',
    properties: {
      recipients: { type: 'array', items: { type: 'string' } },
      note: { type: 'string' },
    },
  },
  // True so the out-of-frame confirmation is part of what mock mode demonstrates.
  requiresConfirmation: true,
  destructive: false,
};

/** The canvas row, with camelCase keys, as the simulation layer emits. */
export function mockCanvasViewRow(): Record<string, unknown> {
  return {
    canvasId: 0,
    token: MOCK_CANVAS_TOKEN,
    title: 'Open task tracker',
    description: 'Everything outstanding, with a nudge button.',
    tsxSource: '',
    bundleCode: MOCK_CANVAS_BUNDLE,
    bundleSha: MOCK_CANVAS_BUNDLE_SHA,
    kitVersion: '0.1.0',
    // A real row's bindings also carry the resolved context and query args, but
    // those are Orchestra's to execute and never leave it — console reads only the
    // alias, which is the whole point of the alias-only contract. Carrying the rest
    // here would imply this side does something with them.
    bindingsJson: JSON.stringify([{ alias: MOCK_CANVAS_ALIAS }]),
    bindingContexts: 'Tasks',
    propsJson: JSON.stringify({ syncedAt: 'a moment ago' }),
    visibility: 'private',
    status: 'published',
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-29T08:30:00Z',
  };
}

/**
 * Seed invocations, so the run-history panel has something to show.
 *
 * One failed and one succeeded on purpose: the panel's job is to report what
 * actually happened, and a history of nothing but successes would demonstrate
 * none of it. Ids are 0-based, matching the auto-counted real ones.
 */
export function mockCanvasInvocationRows(): Array<Record<string, unknown>> {
  return [
    {
      invocationId: 0,
      canvasToken: MOCK_CANVAS_TOKEN,
      actionName: MOCK_CANVAS_ACTION,
      argsJson: JSON.stringify({ recipients: ['Priya', 'Sam'], note: 'First nudge' }),
      status: 'failed',
      error: 'recipients: "Sam" has no email on file',
      runKey: 'mock-run-0',
      createdAt: '2026-07-28T14:02:00Z',
      finishedAt: '2026-07-28T14:02:03Z',
    },
    {
      invocationId: 1,
      canvasToken: MOCK_CANVAS_TOKEN,
      actionName: MOCK_CANVAS_ACTION,
      argsJson: JSON.stringify({ recipients: ['Priya'], note: 'Weekly nudge on open tasks' }),
      status: 'succeeded',
      error: null,
      runKey: 'mock-run-1',
      createdAt: '2026-07-29T08:31:00Z',
      finishedAt: '2026-07-29T08:31:02Z',
    },
  ];
}
