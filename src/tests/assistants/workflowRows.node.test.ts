import { describe, expect, it } from 'vitest';
import {
  catalogRowRequirements,
  catalogRowToWorkflow,
  contentRowToArtifact,
  installationRowToInstallation,
  parseJsonField,
  taskRowToRuntime,
} from '@/utils/workflows/workflowRows';
import type { BrainRow, TaskRow } from '@/types/assistants/brain';

/**
 * The catalogue is published as Orchestra rows, so this is an untyped
 * boundary: JSON fields may arrive decoded or as strings, and unify names the
 * library a surface writes into while Console names the content kind it holds.
 */
function catalogRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: 'daily-briefing',
    name: 'Daily briefing',
    version: '1.2.0',
    category: 'comms',
    iconId: 'briefing',
    description: 'Your calendar and the unread that matters.',
    requirements: [{ slug: 'gmail', name: 'Gmail' }],
    capabilities: ['computer'],
    sets: { guidance: [{ name: 'Briefing tone' }] },
    ...overrides,
  };
}

describe('parseJsonField', () => {
  it('accepts a decoded value, a JSON string, and falls back on junk', () => {
    expect(parseJsonField<string[]>(['a'], [])).toEqual(['a']);
    expect(parseJsonField<string[]>('["a"]', [])).toEqual(['a']);
    expect(parseJsonField<string[]>('not json', [])).toEqual([]);
    expect(parseJsonField<string[]>(null, [])).toEqual([]);
    expect(parseJsonField<string[]>(undefined, [])).toEqual([]);
  });
});

describe('catalogRowToWorkflow', () => {
  it('maps a published row into the shelf view model', () => {
    const workflow = catalogRowToWorkflow(catalogRow());
    expect(workflow).toMatchObject({
      slug: 'daily-briefing',
      name: 'Daily briefing',
      category: 'comms',
      version: '1.2.0',
      iconId: 'briefing',
      capabilities: ['computer'],
    });
  });

  it('maps unify surface names to Console content kinds', () => {
    // Guidance is the library; a procedure is what it holds.
    const workflow = catalogRowToWorkflow(
      catalogRow({
        sets: {
          guidance: [{ name: 'Briefing tone' }],
          knowledge: [{ name: 'Working hours' }],
          canvas: [{ name: 'Sourcing funnel' }],
          data: [{ name: 'expenses_2026' }],
          tasks: [{ name: 'Daily briefing', schedule: 'Every weekday at 08:30' }],
        },
      })
    );
    expect(Object.keys(workflow!.sets).sort()).toEqual(
      ['procedures', 'knowledge', 'canvases', 'tables', 'tasks'].sort()
    );
    expect(workflow!.sets.procedures).toEqual([{ name: 'Briefing tone' }]);
  });

  it('renders the unify-phrased schedule rather than re-deriving one', () => {
    const workflow = catalogRowToWorkflow(
      catalogRow({ sets: '{"tasks":[{"name":"Briefing","schedule":"Every weekday at 08:30"}]}' })
    );
    expect(workflow!.sets.tasks).toEqual([
      { name: 'Briefing', schedule: 'Every weekday at 08:30' },
    ]);
  });

  it('carries the long-form about alongside the one-line description', () => {
    const workflow = catalogRowToWorkflow(
      catalogRow({ about: 'Every weekday at 08:30…\n\nOne message before stand-up.' })
    );
    expect(workflow!.about).toContain('Every weekday');
    expect(catalogRowToWorkflow(catalogRow())!.about).toBe('');
  });

  it('keeps an unknown category on the shelf rather than dropping the workflow', () => {
    expect(catalogRowToWorkflow(catalogRow({ category: 'something-new' }))?.category).toBe('ops');
  });

  it('drops only a row with no slug to key on', () => {
    expect(catalogRowToWorkflow(catalogRow({ slug: null }))).toBeNull();
  });

  it('reads requirements without inventing connection state', () => {
    // The catalogue is connection-agnostic on purpose: it says what the
    // requirement *is* and how to answer it, never whether it is answered.
    expect(catalogRowRequirements(catalogRow())).toEqual([
      { slug: 'gmail', name: 'Gmail', kind: 'app', requiredSecrets: [] },
    ]);
    expect(
      catalogRowRequirements(catalogRow({ requirements: '[{"slug":"notion","name":"Notion"}]' }))
    ).toEqual([{ slug: 'notion', name: 'Notion', kind: 'app', requiredSecrets: [] }]);
  });

  it('carries how a requirement is resolved, not just its slug', () => {
    // Without these a reader has nothing but a gallery lookup — and a
    // workspace is the user's own account, deliberately not a catalogue
    // app, so the lookup finds nothing and reports "couldn't check this
    // app" about the one requirement the gallery never answered for.
    expect(
      catalogRowRequirements(
        catalogRow({
          requirements: JSON.stringify([
            {
              slug: 'google_workspace',
              name: 'Google Workspace',
              kind: 'workspace',
              required_secrets: ['GOOGLE_REFRESH_TOKEN'],
            },
          ]),
        })
      )
    ).toEqual([
      {
        slug: 'google_workspace',
        name: 'Google Workspace',
        kind: 'workspace',
        requiredSecrets: ['GOOGLE_REFRESH_TOKEN'],
      },
    ]);
  });
});

describe('contentRowToArtifact', () => {
  const contentRow = (overrides: Record<string, unknown> = {}) => ({
    contentKey: 'daily-briefing/guidance/db/compose',
    slug: 'daily-briefing',
    surface: 'guidance',
    key: 'db/compose',
    name: 'How to compose the daily briefing',
    body: 'Assemble the briefing in three sections…',
    schedule: '',
    meta: '{"kind":"definition"}',
    ...overrides,
  });

  it('maps a published artifact row, unify surface to Console kind', () => {
    expect(contentRowToArtifact(contentRow())).toEqual({
      contentKey: 'daily-briefing/guidance/db/compose',
      slug: 'daily-briefing',
      kind: 'procedures',
      name: 'How to compose the daily briefing',
      body: 'Assemble the briefing in three sections…',
      schedule: undefined,
      meta: { kind: 'definition' },
    });
  });

  it('keeps the unify-phrased schedule on task artifacts', () => {
    const artifact = contentRowToArtifact(
      contentRow({
        contentKey: 'daily-briefing/tasks/db/morning',
        surface: 'tasks',
        schedule: 'Every weekday at 08:30',
      })
    );
    expect(artifact).toMatchObject({ kind: 'tasks', schedule: 'Every weekday at 08:30' });
  });

  it('drops rows missing identity or naming an unknown surface', () => {
    expect(contentRowToArtifact(contentRow({ contentKey: null }))).toBeNull();
    expect(contentRowToArtifact(contentRow({ surface: 'dashboards' }))).toBeNull();
  });
});

describe('installationRowToInstallation', () => {
  it('maps a stored active row', () => {
    const installation = installationRowToInstallation({
      slug: 'daily-briefing',
      version: '1.2.0',
      status: 'active',
      params: '{"mailbox":"haris@unify.ai"}',
      destination: 'personal',
    } as unknown as BrainRow);

    expect(installation).toMatchObject({
      slug: 'daily-briefing',
      status: 'active',
      installedVersion: '1.2.0',
      params: { mailbox: 'haris@unify.ai' },
      destination: { kind: 'personal' },
    });
  });

  it('keeps the stored partial status as the card state', () => {
    const installation = installationRowToInstallation({
      slug: 'invoice-reconcile',
      status: 'partial',
    } as unknown as BrainRow);
    expect(installation?.status).toBe('partial');
  });

  it('treats a non-personal destination as a team install', () => {
    const installation = installationRowToInstallation({
      slug: 'meeting-recaps',
      status: 'active',
      destination: 'team-revenue',
    } as unknown as BrainRow);
    expect(installation?.destination.kind).toBe('team');
  });
});

describe('taskRowToRuntime', () => {
  it('reads an armed task as enabled with its next run', () => {
    const runtime = taskRowToRuntime({
      taskId: 42,
      name: 'Daily briefing',
      lifecycle: 'scheduled',
      enabled: true,
      nextDueAt: '2026-08-07T09:00:00Z',
    } as unknown as TaskRow);

    expect(runtime.taskId).toBe('42');
    expect(runtime.enabled).toBe(true);
    expect(runtime.nextRunLabel).not.toBe('Held — waiting on a connection');
    expect(runtime.lastRunOutcome).toBe('never');
  });

  it('reads a disarmed task as held', () => {
    const runtime = taskRowToRuntime({
      taskId: 7,
      name: 'Friday cleanup',
      lifecycle: 'disarmed',
      enabled: false,
    } as unknown as TaskRow);

    expect(runtime.enabled).toBe(false);
    expect(runtime.nextRunLabel).toBe('Held — waiting on a connection');
  });
});
