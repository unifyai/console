import { describe, expect, it } from 'vitest';
import { missingRequiredParams } from '@/components/Workflows/WorkflowParamsForm';
import {
  connectableRequirements,
  hasUpdate,
  provisioningTask,
  recurringTasks,
  requirementIsConnectable,
  secretGatedRequirements,
  unmetRequirements,
  workflowCardState,
  workspaceRequirements,
  type Workflow,
  type WorkflowGalleryItem,
  type WorkflowInstallation,
  type WorkflowParam,
} from '@/types/workflows';

function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    slug: 'alpha',
    name: 'Alpha',
    category: 'ops',
    description: 'Test workflow.',
    about: '',
    version: '1.2.0',
    iconId: 'briefing',
    requirements: [],
    capabilities: [],
    paramsSchema: [],
    sets: {},
    ...overrides,
  };
}

function installation(overrides: Partial<WorkflowInstallation> = {}): WorkflowInstallation {
  return {
    slug: 'alpha',
    status: 'active',
    installedVersion: '1.2.0',
    destination: { kind: 'personal' },
    params: {},
    installedAtLabel: 'Today',
    tasks: [],
    ...overrides,
  };
}

describe('workflow selectors', () => {
  it('reports available when there is no installation, else the installation status', () => {
    const bare: WorkflowGalleryItem = { workflow: workflow() };
    expect(workflowCardState(bare)).toBe('available');

    const held: WorkflowGalleryItem = {
      workflow: workflow(),
      installation: installation({ status: 'pending_requirements' }),
    };
    expect(workflowCardState(held)).toBe('pending_requirements');
  });

  it('lists only unconnected requirements as unmet, and never an undeclared one', () => {
    const subject = workflow({
      requirements: [
        { canonicalSlug: 'gmail', displayName: 'Gmail', via: 'connection', connected: true },
        { canonicalSlug: 'notion', displayName: 'Notion', via: 'connection', connected: false },
        { canonicalSlug: 'web', displayName: 'Web browsing', via: 'undeclared', connected: false },
      ],
    });
    // `undeclared` has nothing to check, so it reads as met even at connected: false.
    expect(unmetRequirements(subject).map((req) => req.canonicalSlug)).toEqual(['notion']);
  });

  describe('per-route affordances', () => {
    it('routes an unconnected provider-backed app to connect, with no secret prompt', () => {
      const subject = workflow({
        requirements: [
          { canonicalSlug: 'notion', displayName: 'Notion', via: 'connection', connected: false },
        ],
      });
      expect(connectableRequirements(subject).map((req) => req.canonicalSlug)).toEqual(['notion']);
      expect(secretGatedRequirements(subject)).toHaveLength(0);
    });

    it('routes a secret-gated app to its named secrets, with no OAuth affordance', () => {
      const subject = workflow({
        requirements: [
          {
            canonicalSlug: 'google_drive',
            displayName: 'Google Drive',
            via: 'secret',
            connected: false,
            missingSecrets: ['GOOGLE_REFRESH_TOKEN'],
          },
          {
            canonicalSlug: 'employmenthero',
            displayName: 'Employment Hero',
            via: 'native_package',
            connected: false,
            missingSecrets: ['EMPLOYMENT_HERO_CLIENT_ID'],
          },
        ],
      });
      expect(connectableRequirements(subject)).toHaveLength(0);
      expect(secretGatedRequirements(subject).map((req) => req.missingSecrets?.[0])).toEqual([
        'GOOGLE_REFRESH_TOKEN',
        'EMPLOYMENT_HERO_CLIENT_ID',
      ]);
    });

    it('routes a workspace to its own manager — not the gallery, not a secret', () => {
      // A Workspace is neither a gallery app nor an integration secret: it is
      // connected in the workspace manager, so it must leave both the gallery
      // list and the secret list while still counting as fixable in place.
      const subject = workflow({
        requirements: [
          {
            canonicalSlug: 'google_workspace',
            displayName: 'Google Workspace',
            via: 'workspace',
            connected: false,
            missingSecrets: ['GOOGLE_REFRESH_TOKEN'],
          },
        ],
      });
      expect(workspaceRequirements(subject).map((req) => req.canonicalSlug)).toEqual([
        'google_workspace',
      ]);
      expect(connectableRequirements(subject)).toHaveLength(0);
      expect(secretGatedRequirements(subject)).toHaveLength(0);
      expect(unmetRequirements(subject)).toHaveLength(1);
      // Surfaces with room for one action offer it: the card, the row, the banner.
      expect(subject.requirements.filter(requirementIsConnectable)).toHaveLength(1);
    });

    it('treats an app connected by connection row as met despite a missing secret', () => {
      // One route is enough — a live connection outranks a missing secret.
      const subject = workflow({
        requirements: [
          {
            canonicalSlug: 'gmail',
            displayName: 'Gmail',
            via: 'connection',
            connected: true,
            missingSecrets: ['GOOGLE_REFRESH_TOKEN'],
          },
        ],
      });
      expect(unmetRequirements(subject)).toHaveLength(0);
      expect(secretGatedRequirements(subject)).toHaveLength(0);
      expect(connectableRequirements(subject)).toHaveLength(0);
    });

    it('shows nothing at all for an undeclared requirement', () => {
      const subject = workflow({
        requirements: [
          { canonicalSlug: 'web', displayName: 'Web browsing', via: 'undeclared', connected: true },
        ],
      });
      expect(unmetRequirements(subject)).toHaveLength(0);
      expect(connectableRequirements(subject)).toHaveLength(0);
      expect(secretGatedRequirements(subject)).toHaveLength(0);
      expect(workspaceRequirements(subject)).toHaveLength(0);
    });
  });

  it('flags an update only when the installed version lags the catalog version', () => {
    const current: WorkflowGalleryItem = {
      workflow: workflow({ version: '1.2.0' }),
      installation: installation({ installedVersion: '1.2.0' }),
    };
    expect(hasUpdate(current)).toBe(false);

    const stale: WorkflowGalleryItem = {
      workflow: workflow({ version: '1.2.0' }),
      installation: installation({ installedVersion: '1.0.1' }),
    };
    expect(hasUpdate(stale)).toBe(true);

    expect(hasUpdate({ workflow: workflow() })).toBe(false);
  });

  it('splits recurring tasks from the one-shot job by flag, not by schedule prose', () => {
    const subject = workflow({
      sets: {
        tasks: [
          { name: 'Weekly batch', schedule: 'Every Monday at 7:00am, your timezone' },
          { name: 'Backfill history', schedule: 'Once, at install', runsOnce: true },
        ],
      },
    });
    expect(recurringTasks(subject).map((task) => task.name)).toEqual(['Weekly batch']);
    expect(provisioningTask(subject)?.name).toBe('Backfill history');

    const noOneShot = workflow({
      sets: { tasks: [{ name: 'Weekly batch', schedule: 'Every Monday' }] },
    });
    expect(provisioningTask(noOneShot)).toBeUndefined();

    // The schedule is display copy: rewording it must not reclassify the job.
    const reworded = workflow({
      sets: {
        tasks: [{ name: 'Backfill history', schedule: 'A single catch-up pass', runsOnce: true }],
      },
    });
    expect(provisioningTask(reworded)?.name).toBe('Backfill history');
    expect(recurringTasks(reworded)).toHaveLength(0);

    // …and prose that merely reads like a one-shot must not become one.
    const proseOnly = workflow({
      sets: { tasks: [{ name: 'Hourly sweep', schedule: 'Once every hour' }] },
    });
    expect(provisioningTask(proseOnly)).toBeUndefined();
    expect(recurringTasks(proseOnly)).toHaveLength(1);
  });

  it('blocks install on required params that are blank or whitespace only', () => {
    const params: WorkflowParam[] = [
      { name: 'icp', label: 'Who counts as a lead', type: 'textarea', required: true, help: 'h' },
      { name: 'note', label: 'Note', type: 'text', required: false, help: 'h' },
    ];
    expect(missingRequiredParams(params, {}).map((param) => param.name)).toEqual(['icp']);
    expect(missingRequiredParams(params, { icp: '   ' }).map((param) => param.name)).toEqual([
      'icp',
    ]);
    expect(missingRequiredParams(params, { icp: 'Ops leads' })).toHaveLength(0);
  });

  it('treats filled numbers as present, including zero-adjacent values', () => {
    const params: WorkflowParam[] = [
      { name: 'batch', label: 'Leads per batch', type: 'number', required: true, help: 'h' },
    ];
    expect(missingRequiredParams(params, { batch: 25 })).toHaveLength(0);
    expect(missingRequiredParams(params, { batch: 0 })).toHaveLength(0);
    expect(missingRequiredParams(params, {})).toHaveLength(1);
  });
});
