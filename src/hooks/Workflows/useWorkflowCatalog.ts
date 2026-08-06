'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  MOCK_WORKFLOW_GALLERY_ITEMS,
  shouldUseMockWorkflows,
} from '@/utils/assistants/workflow-mock-data';
import { WORKFLOW_SURFACE_ORDER } from '@/components/Workflows/workflowCategories';
import type { WorkflowParamValues } from '@/components/Workflows/WorkflowParamsForm';
import { fetchBrainContext } from '@/lib/client/brain';
import {
  catalogRowRequirements,
  catalogRowToWorkflow,
  installationRowToInstallation,
  taskRowToRuntime,
} from '@/utils/workflows/workflowRows';
import { resolveRequirements } from '@/utils/workflows/requirementResolution';
import type { RequirementResolutionContext } from '@/utils/workflows/requirementResolution';
import type { Assistant } from '@/types/assistants/assistant';
import type { BrainRow, TaskRow } from '@/types/assistants/brain';
import {
  provisioningTask,
  unmetRequirements,
  type WorkflowDestination,
  type WorkflowGalleryItem,
} from '@/types/workflows';

/** Milliseconds between optimistic provisioning steps while an install plants. */
const PROVISIONING_STEP_MS = 620;

const CATALOG_CONTEXT = 'Workflows/Catalog';
const INSTALLATIONS_CONTEXT = 'Workflows';
const CATALOG_PAGE_SIZE = 200;

/**
 * Read the published catalogue and this assistant's installations, then join
 * them by slug. The absence of an installation row *is* the available state.
 *
 * A never-booted assistant has no catalogue rows yet — the publish happens on
 * its first boot — and `fetchBrainContext` answers a missing context with an
 * empty page rather than throwing, so that lands on the empty state, not an
 * error.
 */
async function loadWorkflowGallery(
  assistant: Assistant,
  requirementContext?: RequirementResolutionContext
): Promise<WorkflowGalleryItem[]> {
  const [catalog, installations] = await Promise.all([
    fetchBrainContext<BrainRow>(assistant, CATALOG_CONTEXT, { limit: CATALOG_PAGE_SIZE }),
    fetchBrainContext<BrainRow>(assistant, INSTALLATIONS_CONTEXT, { limit: CATALOG_PAGE_SIZE }),
  ]);

  const installationRows = new Map(
    installations.rows.flatMap((row) => {
      const slug = (row as Record<string, unknown>).slug;
      return typeof slug === 'string' ? [[slug, row] as const] : [];
    })
  );

  // A workflow has no runtime of its own: each installed slug's tasks are
  // ordinary Tasks rows, filtered server-side by the slug that manages them.
  const runtimeBySlug = new Map<string, ReturnType<typeof taskRowToRuntime>[]>();
  await Promise.all(
    [...installationRows.keys()].map(async (slug) => {
      const tasks = await fetchBrainContext<TaskRow>(assistant, 'Tasks', {
        filter: `managed_by == ${JSON.stringify(slug)}`,
        limit: CATALOG_PAGE_SIZE,
      });
      runtimeBySlug.set(slug, tasks.rows.map(taskRowToRuntime));
    })
  );

  return catalog.rows.flatMap((row) => {
    const workflow = catalogRowToWorkflow(row);
    if (!workflow) return [];

    // Requirements are published connection-agnostic; the route is resolved
    // against the integrations layer Console already loads.
    workflow.requirements = requirementContext
      ? resolveRequirements(catalogRowRequirements(row), requirementContext)
      : catalogRowRequirements(row).map((requirement) => ({
          canonicalSlug: requirement.slug,
          displayName: requirement.name,
          via: 'undeclared' as const,
          connected: true,
        }));

    const installationRow = installationRows.get(workflow.slug);
    if (!installationRow) return [{ workflow }];

    const installation = installationRowToInstallation(
      installationRow,
      runtimeBySlug.get(workflow.slug) ?? []
    );
    if (!installation) return [{ workflow }];

    // `needs_connection` is never stored — derive it, and let `partial`
    // outrank it because something genuinely failed to plant.
    if (installation.status === 'active' && unmetRequirements(workflow).length > 0) {
      installation.status = 'pending_requirements';
      installation.tasks = installation.tasks.map((task) => ({ ...task, enabled: false }));
    }

    return [{ workflow, installation }];
  });
}

export interface WorkflowProvisioningState {
  slug: string;
  step: number;
  values: WorkflowParamValues;
  destination: WorkflowDestination;
}

interface UseWorkflowCatalogOptions {
  /** Gate fetching to the pane being visible, like the integrations catalog. */
  enabled?: boolean;
  /** Required for the live reads; absent only in mock-only callers. */
  assistant?: Assistant | null;
  /** Resolves each requirement's route. Omitted until integrations load. */
  requirementContext?: RequirementResolutionContext;
}

/**
 * Install state and transitions for the Workflows shelf, mirroring
 * useProviderIntegrationCatalog's shape: a mock short-circuit up front, a
 * seam for the live catalog behind it, and every mutation exposed as a
 * typed transition.
 *
 * The live WorkflowManager catalog feed is not exposed yet, so the live
 * path resolves an empty catalog; mock mode (NEXT_PUBLIC_MOCK_SIM,
 * ?mockWorkflows=1, or the localStorage flag) serves the curated mock
 * catalog. The transitions below are the design contract and must survive
 * the swap to real mutations:
 *
 * INSTALL   plant each surface optimistically (~620ms per surface), then
 *           settle into pending_requirements (any app unconnected — jobs
 *           planted, held), provisioning (a "Once, at install" job), or
 *           active.
 * CONNECT   connecting an app re-evaluates every held installation; any
 *           whose requirements are now all met flips to active and its
 *           tasks arm — and a toast says so.
 * SETUP     pause/resume toggles; stop keeps partial results, goes active.
 * FAILED    retry replants the failed items and clears the failures.
 * UNINSTALL removes the installation; keepData is recorded for the table
 *           the workflow owns.
 */
export function useWorkflowCatalog(assistantId: string, options: UseWorkflowCatalogOptions = {}) {
  const { enabled = true, assistant = null, requirementContext } = options;

  const [items, setItems] = React.useState<WorkflowGalleryItem[]>([]);
  const [isMock, setIsMock] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [provisioning, setProvisioning] = React.useState<WorkflowProvisioningState | null>(null);

  const requirementContextRef = React.useRef(requirementContext);
  requirementContextRef.current = requirementContext;

  React.useEffect(() => {
    if (!enabled || hasLoaded) return;
    if (shouldUseMockWorkflows()) {
      setItems(MOCK_WORKFLOW_GALLERY_ITEMS);
      setIsMock(true);
      setHasLoaded(true);
      return;
    }
    if (!assistant) return;

    let cancelled = false;
    void (async () => {
      const next = await loadWorkflowGallery(assistant, requirementContextRef.current);
      if (cancelled) return;
      setItems(next);
      setIsMock(false);
      setHasLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, hasLoaded, assistantId, assistant]);

  const refresh = React.useCallback(() => {
    setHasLoaded(false);
  }, []);

  const patch = React.useCallback(
    (slug: string, next: (item: WorkflowGalleryItem) => WorkflowGalleryItem) =>
      setItems((list) => list.map((item) => (item.workflow.slug === slug ? next(item) : item))),
    []
  );

  /* --- connect loop ------------------------------------------------------- */
  const connect = React.useCallback(
    (canonicalSlug: string) => {
      // Derive the toast from the pre-update state — the setItems updater runs
      // later in React's cycle, so writes made inside it are not visible here.
      const connectedName =
        items
          .flatMap((item) => item.workflow.requirements)
          .find((requirement) => requirement.canonicalSlug === canonicalSlug)?.displayName ?? null;
      const armsAny = items.some(
        (item) =>
          item.installation?.status === 'pending_requirements' &&
          item.workflow.requirements.every(
            (requirement) => requirement.connected || requirement.canonicalSlug === canonicalSlug
          ) &&
          item.workflow.requirements.some(
            (requirement) => requirement.canonicalSlug === canonicalSlug
          )
      );

      setItems((list) =>
        list.map((item) => {
          const requirements = item.workflow.requirements.map((requirement) =>
            requirement.canonicalSlug === canonicalSlug
              ? { ...requirement, connected: true }
              : requirement
          );
          const workflow = { ...item.workflow, requirements };
          const stillMissing = requirements.some((requirement) => !requirement.connected);
          if (item.installation?.status === 'pending_requirements' && !stillMissing) {
            return {
              workflow,
              installation: {
                ...item.installation,
                status: 'active' as const,
                tasks: item.installation.tasks.map((task) => ({
                  ...task,
                  enabled: true,
                  nextRunLabel: 'As scheduled',
                })),
              },
            };
          }
          return { ...item, workflow };
        })
      );

      if (connectedName) {
        toast.success(
          armsAny
            ? `${connectedName} connected — any held jobs are now armed.`
            : `${connectedName} connected.`
        );
      }
    },
    [items]
  );

  /* --- install ------------------------------------------------------------ */
  const install = React.useCallback(
    (slug: string, values: WorkflowParamValues, destination: WorkflowDestination) => {
      setProvisioning({ slug, step: 0, values, destination });
    },
    []
  );

  React.useEffect(() => {
    if (!provisioning) return;
    const item = items.find((candidate) => candidate.workflow.slug === provisioning.slug);
    if (!item) {
      setProvisioning(null);
      return;
    }
    const surfaces = WORKFLOW_SURFACE_ORDER.filter(
      (kind) => (item.workflow.sets[kind]?.length ?? 0) > 0
    );
    if (provisioning.step >= surfaces.length) {
      const { workflow } = item;
      const held = unmetRequirements(workflow).length > 0;
      const oneShot = provisioningTask(workflow);
      patch(workflow.slug, (current) => ({
        ...current,
        installation: {
          slug: workflow.slug,
          status: held ? 'pending_requirements' : oneShot ? 'provisioning' : 'active',
          installedVersion: workflow.version,
          destination: provisioning.destination,
          params: provisioning.values,
          installedAtLabel: 'Just now',
          setup:
            !held && oneShot
              ? {
                  label: oneShot.name,
                  percent: 4,
                  detail: 'just started',
                  etaLabel: 'a few minutes left',
                  paused: false,
                }
              : undefined,
          tasks: (workflow.sets.tasks ?? []).map((task, index) => ({
            taskId: `${workflow.slug}-task-${index}`,
            name: task.name,
            enabled: !held && !oneShot,
            nextRunLabel: held
              ? 'Held — waiting on a connection'
              : oneShot
                ? 'Arms when setup finishes'
                : 'As scheduled',
            lastRunLabel: 'Never run',
            lastRunOutcome: 'never',
            href: '',
          })),
        },
      }));
      setProvisioning(null);
      return;
    }
    const timer = setTimeout(
      () =>
        setProvisioning((current) => (current ? { ...current, step: current.step + 1 } : current)),
      PROVISIONING_STEP_MS
    );
    return () => clearTimeout(timer);
  }, [provisioning, items, patch]);

  /* --- provisioning / failed / update -------------------------------------- */
  const toggleSetup = React.useCallback(
    (slug: string) =>
      patch(slug, (item) =>
        item.installation?.setup
          ? {
              ...item,
              installation: {
                ...item.installation,
                setup: { ...item.installation.setup, paused: !item.installation.setup.paused },
              },
            }
          : item
      ),
    [patch]
  );

  const stopSetup = React.useCallback(
    (slug: string) =>
      patch(slug, (item) =>
        item.installation
          ? {
              ...item,
              installation: {
                ...item.installation,
                status: 'active',
                setup: undefined,
                tasks: item.installation.tasks.map((task) => ({
                  ...task,
                  enabled: true,
                  nextRunLabel: 'As scheduled',
                })),
              },
            }
          : item
      ),
    [patch]
  );

  const retry = React.useCallback(
    (slug: string) =>
      patch(slug, (item) =>
        item.installation
          ? {
              ...item,
              installation: { ...item.installation, status: 'active', failures: undefined },
            }
          : item
      ),
    [patch]
  );

  const update = React.useCallback(
    (slug: string) =>
      patch(slug, (item) =>
        item.installation
          ? {
              ...item,
              installation: { ...item.installation, installedVersion: item.workflow.version },
            }
          : item
      ),
    [patch]
  );

  const saveParams = React.useCallback(
    (slug: string, values: WorkflowParamValues) =>
      patch(slug, (item) =>
        item.installation
          ? { ...item, installation: { ...item.installation, params: values } }
          : item
      ),
    [patch]
  );

  const uninstall = React.useCallback(
    (slug: string, _options: { keepData: boolean }) =>
      patch(slug, (item) => ({ workflow: item.workflow })),
    [patch]
  );

  return {
    items,
    isMock,
    hasLoaded,
    isLoading: enabled && !hasLoaded,
    /**
     * Mutations are local-only: planting content needs unify's surface
     * registry and reconcile engine, which is the assistant's work, and the
     * record-and-wake path does not exist yet. The shelf must not claim an
     * install happened when nothing was persisted, so surfaces gate their
     * actions on this rather than pretending.
     */
    canMutate: isMock,
    provisioning,
    refresh,
    connect,
    install,
    toggleSetup,
    stopSetup,
    retry,
    update,
    saveParams,
    uninstall,
  };
}
