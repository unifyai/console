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
import { camelToSnakeObject } from '@/utils/casing';
import {
  fetchWorkflowsCatalog,
  submitWorkflowRequest,
  type WorkflowRequestAction,
} from '@/lib/client/workflows';
import {
  catalogRowRequirements,
  catalogRowToWorkflow,
  installationRowToInstallation,
  taskRowToRuntime,
  type CatalogRequirement,
} from '@/utils/workflows/workflowRows';
import { resolveRequirements } from '@/utils/workflows/requirementResolution';
import { useRequirementDefinitions } from '@/hooks/Workflows/useRequirementDefinitions';
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

const INSTALLATIONS_CONTEXT = 'Workflows';
const CATALOG_PAGE_SIZE = 200;

interface WorkflowGalleryLoad {
  items: WorkflowGalleryItem[];
  /** Published requirements per slug, connection-agnostic, for re-resolution. */
  rawRequirements: Map<string, CatalogRequirement[]>;
}

/**
 * Read the published catalogue and this assistant's installations, then join
 * them by slug. The absence of an installation row *is* the available state.
 *
 * Requirements are deliberately NOT resolved here: connection state arrives
 * from the integrations layer on its own schedule, so the raw requirements
 * are returned for the hook to resolve reactively — a load that froze them
 * against a not-yet-loaded integrations catalogue once rendered every app
 * as "Built in".
 *
 * An environment whose Builtins project has not been seeded yet has no
 * catalogue rows, and a never-booted assistant has no installation rows;
 * both reads answer empty rather than throwing, so either lands on the
 * empty state, not an error.
 */
async function loadWorkflowGallery(assistant: Assistant): Promise<WorkflowGalleryLoad> {
  // The catalogue is platform data in the public-read Builtins project —
  // one shelf for everyone, seeded by admin processes — while installations
  // are this assistant's own rows. Two stores, one join key.
  const [catalogRows, installations] = await Promise.all([
    fetchWorkflowsCatalog(),
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

  const rawRequirements = new Map<string, CatalogRequirement[]>();
  const items = catalogRows.flatMap((row) => {
    const workflow = catalogRowToWorkflow(row);
    if (!workflow) return [];
    rawRequirements.set(workflow.slug, catalogRowRequirements(row));

    const installationRow = installationRows.get(workflow.slug);
    if (!installationRow) return [{ workflow }];

    const installation = installationRowToInstallation(
      installationRow,
      runtimeBySlug.get(workflow.slug) ?? []
    );
    return installation ? [{ workflow, installation }] : [{ workflow }];
  });

  return { items, rawRequirements };
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
  /**
   * Fetch definitions for requirement slugs the supplied context lacks.
   *
   * The integrations browse catalogue carries one alphabetical page plus the
   * pinned connected apps, so a required-but-unconnected app can sort far past
   * it — Gmail, in a ~1k-app catalogue. Resolving against that partial map
   * alone reports a real app as unverifiable, so the gaps are fetched by slug.
   * Off in mock mode and until the integrations catalogue has answered.
   */
  resolveMissingDefinitions?: boolean;
}

/**
 * Install state and transitions for the Workflows shelf, mirroring
 * useProviderIntegrationCatalog's shape: a mock short-circuit up front, a
 * seam for the live catalog behind it, and every mutation exposed as a
 * typed transition.
 *
 * Reads join the published catalogue to this assistant's installations; mock
 * mode (NEXT_PUBLIC_MOCK_SIM, ?mockWorkflows=1, or the localStorage flag)
 * serves the curated mock catalog with no backend at all. Mutations record a
 * `Workflows/Requests` row and wake the assistant, which does the planting —
 * Console cannot, because that needs unify's reconcile engine. The optimistic
 * transitions below run while that happens, so the wait shows what is landing:
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
 * UNINSTALL removes the installation; `keepData` keeps the stored tables the
 *           workflow filled and prunes the rest.
 */
export function useWorkflowCatalog(assistantId: string, options: UseWorkflowCatalogOptions = {}) {
  const {
    enabled = true,
    assistant = null,
    requirementContext,
    resolveMissingDefinitions = false,
  } = options;

  const [baseItems, setBaseItems] = React.useState<WorkflowGalleryItem[]>([]);
  const [rawRequirements, setRawRequirements] = React.useState<Map<string, CatalogRequirement[]>>(
    new Map()
  );
  const [isMock, setIsMock] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [provisioning, setProvisioning] = React.useState<WorkflowProvisioningState | null>(null);

  React.useEffect(() => {
    if (!enabled || hasLoaded) return;
    if (shouldUseMockWorkflows()) {
      setBaseItems(MOCK_WORKFLOW_GALLERY_ITEMS);
      setRawRequirements(new Map());
      setIsMock(true);
      setHasLoaded(true);
      return;
    }
    if (!assistant) return;

    let cancelled = false;
    void (async () => {
      const next = await loadWorkflowGallery(assistant);
      if (cancelled) return;
      setBaseItems(next.items);
      setRawRequirements(next.rawRequirements);
      setIsMock(false);
      setHasLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, hasLoaded, assistantId, assistant]);

  /**
   * Every requirement slug the shelf names, taken from the published rows so it
   * does not depend on resolution having happened — otherwise collecting the
   * slugs and resolving them would each be waiting on the other.
   */
  const requirementSlugs = React.useMemo(() => {
    const slugs = new Set<string>();
    for (const requirements of rawRequirements.values()) {
      for (const requirement of requirements) slugs.add(requirement.slug);
    }
    return [...slugs].sort();
  }, [rawRequirements]);

  const knownSlugs = React.useMemo(
    () => new Set(requirementContext ? requirementContext.definitionsBySlug.keys() : []),
    [requirementContext]
  );

  const extraDefinitions = useRequirementDefinitions({
    assistantId,
    slugs: requirementSlugs,
    knownSlugs,
    enabled: resolveMissingDefinitions && !isMock,
  });

  /** The supplied context with per-slug gaps filled. Base definitions win: they
   * carry the connection state merged in by the integrations catalogue. */
  const mergedContext = React.useMemo<RequirementResolutionContext | undefined>(() => {
    if (!requirementContext) return undefined;
    const filled = Object.entries(extraDefinitions).filter(([, value]) => !!value);
    if (filled.length === 0) return requirementContext;
    const definitionsBySlug = new Map(filled.map(([slug, value]) => [slug, value!] as const));
    for (const [slug, value] of requirementContext.definitionsBySlug) {
      definitionsBySlug.set(slug, value);
    }
    return { ...requirementContext, definitionsBySlug };
  }, [requirementContext, extraDefinitions]);

  /**
   * Requirements resolve reactively: the integrations catalogue and the
   * secret keyset arrive on their own schedule, and each arrival re-resolves
   * every requirement. Until the context exists a requirement is
   * `unresolved` — visibly unverified, never a fabricated green check.
   * Derived install status follows the same rhythm, because
   * `pending_requirements` is never stored and `partial` outranks it.
   */
  const items = React.useMemo<WorkflowGalleryItem[]>(() => {
    if (isMock) return baseItems;
    return baseItems.map((item) => {
      const raw = rawRequirements.get(item.workflow.slug) ?? [];
      const requirements = mergedContext
        ? resolveRequirements(raw, mergedContext)
        : raw.map((requirement) => ({
            canonicalSlug: requirement.slug,
            displayName: requirement.name,
            via: 'unresolved' as const,
            connected: false,
          }));
      const workflow = { ...item.workflow, requirements };
      if (!item.installation) return { workflow };
      if (item.installation.status === 'active' && unmetRequirements(workflow).length > 0) {
        return {
          workflow,
          installation: {
            ...item.installation,
            status: 'pending_requirements' as const,
            tasks: item.installation.tasks.map((task) => ({ ...task, enabled: false })),
          },
        };
      }
      return { workflow, installation: item.installation };
    });
  }, [baseItems, rawRequirements, mergedContext, isMock]);

  const refresh = React.useCallback(() => {
    setHasLoaded(false);
  }, []);

  const patch = React.useCallback(
    (slug: string, next: (item: WorkflowGalleryItem) => WorkflowGalleryItem) =>
      setBaseItems((list) => list.map((item) => (item.workflow.slug === slug ? next(item) : item))),
    []
  );

  /**
   * Record an install-state change for the assistant to carry out.
   *
   * Mock mode stays entirely local — it exists to review the UI with no
   * backend. Otherwise the row is written and the assistant woken; a wake that
   * could not be delivered is reported as queued rather than failed, because
   * the row is durable and the boot sweep drains the same queue.
   */
  const request = React.useCallback(
    async (
      slug: string,
      action: WorkflowRequestAction,
      options: {
        params?: WorkflowParamValues;
        destination?: WorkflowDestination;
      } = {}
    ): Promise<boolean> => {
      if (isMock || !assistant) return true;
      const destination = options.destination ?? { kind: 'personal' };
      try {
        const { dispatched } = await submitWorkflowRequest(assistant, {
          slug,
          action,
          params: options.params ?? {},
          destination:
            destination.kind === 'team'
              ? { kind: 'team', teamId: Number(destination.teamId) }
              : { kind: 'personal' },
        });
        if (!dispatched) {
          toast.message('Queued for your teammate.', {
            description: 'It will be applied the next time they wake up.',
          });
        }
        return true;
      } catch (error) {
        console.error('Failed to record the workflow request', error);
        toast.error('Could not record that change. Please try again.');
        return false;
      }
    },
    [assistant, isMock]
  );

  /* --- connect loop ------------------------------------------------------- */
  const connect = React.useCallback(
    (canonicalSlug: string) => {
      // Derive the toast from the pre-update state — the state updater runs
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

      setBaseItems((list) =>
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
      // The optimistic surface-by-surface list runs while the assistant does
      // the real work, so the wait shows what is landing rather than a spinner.
      setProvisioning({ slug, step: 0, values, destination });
      void request(slug, 'install', { params: values, destination });
    },
    [request]
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
    (slug: string) => {
      // A repeat install IS the retry path in unify: it reconciles to the
      // current bundle and re-runs whatever failed to land.
      void request(slug, 'install');
      patch(slug, (item) =>
        item.installation
          ? {
              ...item,
              installation: { ...item.installation, status: 'active', failures: undefined },
            }
          : item
      );
    },
    [patch, request]
  );

  const update = React.useCallback(
    (slug: string) => {
      void request(slug, 'update');
      patch(slug, (item) =>
        item.installation
          ? {
              ...item,
              installation: { ...item.installation, installedVersion: item.workflow.version },
            }
          : item
      );
    },
    [patch, request]
  );

  const saveParams = React.useCallback(
    (slug: string, values: WorkflowParamValues) => {
      void request(slug, 'save_params', { params: values });
      patch(slug, (item) =>
        item.installation
          ? { ...item, installation: { ...item.installation, params: values } }
          : item
      );
    },
    [patch, request]
  );

  const uninstall = React.useCallback(
    (slug: string, options: { keepData: boolean }) => {
      // keepData keeps the stored tables the workflow filled and prunes
      // everything else — the work it produced outliving the setup that made
      // it. Carried in params because it is an argument to this one action.
      void request(slug, 'uninstall', {
        params: camelToSnakeObject({ keepData: options.keepData }),
      });
      patch(slug, (item) => ({ workflow: item.workflow }));
    },
    [patch, request]
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
    canMutate: isMock || !!assistant,
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
