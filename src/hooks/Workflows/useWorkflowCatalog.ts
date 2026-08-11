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
  fetchWorkflowInstallations,
  fetchWorkflowRequests,
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

/**
 * Milliseconds between simulated provisioning steps — mock mode only.
 *
 * Against a real backend an install settles in about a second, well inside
 * one poll interval, so a ladder of steps is not progress: it is an
 * animation that finishes before anything is known and then contradicts
 * itself when the request fails. Real per-surface progress would need a
 * write per surface to report stages nothing can observe at this duration.
 * The backend path therefore shows one honest indeterminate state and the
 * request's real outcome.
 */
const PROVISIONING_STEP_MS = 620;

/**
 * How often the recorded request rows are re-read while one is in flight.
 *
 * The read itself costs about 400ms server-side, so a faster cadence issues
 * the next one before the last has answered: a request that never settles —
 * an assistant that failed to wake, a row left pending — then holds an open
 * connection more or less permanently. Two seconds keeps a settled install
 * visible within one beat of it happening while leaving the poll idle most
 * of the time. Nothing polls at all outside that window.
 */
const REQUEST_POLL_MS = 2000;

const CATALOG_PAGE_SIZE = 200;

/**
 * What the assistant has actually done with a recorded change, as opposed to
 * what the shelf hoped it would.
 *
 * The row is the mechanism: Console persists the intent and asks Orchestra to
 * wake the assistant, which does the planting. Rendering that wait as a local
 * animation made a claimed-and-failing request look exactly like a successful
 * one, so these states come from the `Workflows/Requests` row itself.
 *
 * `queued` is the one state the row cannot report, because it is about the
 * wake rather than the work: the row is written but no assistant was woken —
 * an environment with no `ORCHESTRA_ADMIN_KEY`, or an Orchestra that could not
 * be reached. It is not a failure; the boot sweep drains the same queue.
 */
export type WorkflowRequestStatus = 'queued' | 'pending' | 'running' | 'succeeded' | 'failed';

export interface WorkflowRequestState {
  requestId: string;
  slug: string;
  action: WorkflowRequestAction;
  status: WorkflowRequestStatus;
  /** False when the row is durable but no assistant was woken for it. */
  dispatched: boolean;
  /** Human-readable reason, present only on `failed`. */
  error?: string;
}

function isSettled(request: WorkflowRequestState): boolean {
  return request.status === 'succeeded' || request.status === 'failed';
}

const ROW_STATUSES: WorkflowRequestStatus[] = ['pending', 'running', 'succeeded', 'failed'];

/**
 * The row's `status`, narrowed to what the surfaces know how to render.
 *
 * A value this client has never heard of reads as still in flight rather
 * than as an unhandled case: showing nothing for an unknown status is the
 * one outcome worse than showing "still working on it".
 */
function rowStatus(raw: unknown): WorkflowRequestStatus {
  const value = String(raw ?? '');
  return ROW_STATUSES.includes(value as WorkflowRequestStatus)
    ? (value as WorkflowRequestStatus)
    : 'pending';
}

/** The one sentence a surface shows for a request in this state. */
export function workflowRequestCopy(request: WorkflowRequestState): string {
  switch (request.status) {
    case 'queued':
      return 'Queued — your teammate will apply this the next time they wake up.';
    case 'pending':
      return 'Waking your teammate to apply this…';
    case 'running':
      return 'Your teammate is applying this now…';
    case 'failed':
      return request.error || "Your teammate couldn't apply this.";
    case 'succeeded':
      return 'Applied.';
  }
}

/**
 * Read a request row's failure into one sentence.
 *
 * The stored shape is a JSON object keyed by surface for a per-surface
 * failure, or `{"error": reason}` for a whole-request one — the same shape the
 * installation's `partial` status reports.
 */
function requestErrorText(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim() === '{}') return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(parsed);
    if (entries.length === 0) return undefined;
    if (entries.length === 1 && entries[0][0] === 'error') return String(entries[0][1]);
    return entries.map(([surface, reason]) => `${surface}: ${String(reason)}`).join('; ');
  } catch {
    return raw.slice(0, 200);
  }
}

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
 * both land on the empty state. A *failed* installations read throws
 * instead — folded into the join it reads as "nothing installed", which
 * un-installs the whole shelf on screen until something reloads it.
 */
async function loadWorkflowGallery(assistant: Assistant): Promise<WorkflowGalleryLoad> {
  // The catalogue is platform data in the public-read Builtins project —
  // one shelf for everyone, seeded by admin processes — while installations
  // are this assistant's own rows. Two stores, one join key.
  const [catalogRows, installations] = await Promise.all([
    fetchWorkflowsCatalog(),
    fetchWorkflowInstallations(assistant),
  ]);

  const installationRows = new Map(
    installations.flatMap((row) => {
      const slug = row.slug;
      return typeof slug === 'string' ? [[slug, row as BrainRow] as const] : [];
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
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [provisioning, setProvisioning] = React.useState<WorkflowProvisioningState | null>(null);
  // Recorded changes this session is watching, keyed by slug — one in flight
  // per workflow, because a second change to the same workflow supersedes the
  // first rather than queueing behind it.
  const [requests, setRequests] = React.useState<Record<string, WorkflowRequestState>>({});

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
    let retry: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const next = await loadWorkflowGallery(assistant);
        if (cancelled) return;
        setBaseItems(next.items);
        setRawRequirements(next.rawRequirements);
        setIsMock(false);
        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load the workflow gallery', error);
        if (cancelled) return;
        // Whatever is already on screen stays; retry by nudging the nonce
        // this effect keys on, since `hasLoaded` alone never re-fires it.
        retry = setTimeout(() => setLoadAttempt((attempt) => attempt + 1), 5000);
      }
    })();
    return () => {
      cancelled = true;
      if (retry !== undefined) clearTimeout(retry);
    };
  }, [enabled, hasLoaded, assistantId, assistant, loadAttempt]);

  /**
   * Every requirement slug the shelf names, taken from the published rows so it
   * does not depend on resolution having happened — otherwise collecting the
   * slugs and resolving them would each be waiting on the other.
   */
  const requirementSlugs = React.useMemo(() => {
    const slugs = new Set<string>();
    for (const requirements of rawRequirements.values()) {
      for (const requirement of requirements) {
        slugs.add(requirement.slug);
        // Every alternative is resolved too: one of them being connected is
        // what meets the requirement, and an unfetched option renders as an
        // app nobody could check.
        for (const option of requirement.alternatives) slugs.add(option.slug);
      }
    }
    return [...slugs].sort();
  }, [rawRequirements]);

  const knownSlugs = React.useMemo(
    () => new Set(requirementContext ? requirementContext.definitionsBySlug.keys() : []),
    [requirementContext]
  );

  const {
    bySlug: extraDefinitions,
    isResolving: requirementsResolving,
    forget: forgetRequirementDefinition,
  } = useRequirementDefinitions({
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
        const { requestId, dispatched } = await submitWorkflowRequest(assistant, {
          slug,
          action,
          params: options.params ?? {},
          destination:
            destination.kind === 'team'
              ? { kind: 'team', teamId: Number(destination.teamId) }
              : { kind: 'personal' },
        });
        // Watch the row from here. Its own `status` is what the surfaces
        // render; `dispatched` only says whether anyone was woken for it.
        setRequests((current) => ({
          ...current,
          [slug]: {
            requestId,
            slug,
            action,
            status: dispatched ? 'pending' : 'queued',
            dispatched,
          },
        }));
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

  /* --- recorded request state --------------------------------------------- */
  const hasRequestInFlight = React.useMemo(
    () => Object.values(requests).some((request) => !isSettled(request)),
    [requests]
  );

  // Poll only while something is in flight, and key the effect on that one
  // boolean so a status write does not tear down and rebuild the interval.
  React.useEffect(() => {
    if (!hasRequestInFlight || isMock || !assistant) return;
    let cancelled = false;
    const read = async () => {
      const rows = await fetchWorkflowRequests(assistant).catch((error) => {
        console.error('Failed to read the workflow requests', error);
        return [] as Record<string, unknown>[];
      });
      if (cancelled || rows.length === 0) return;
      const byId = new Map(rows.map((row) => [String(row.requestId ?? ''), row] as const));
      setRequests((current) => {
        let changed = false;
        const next = { ...current };
        for (const [slug, request] of Object.entries(current)) {
          const row = byId.get(request.requestId);
          if (!row) continue;
          const status = rowStatus(row.status);
          // `queued` is Console's own knowledge about the wake, and the row
          // says nothing about it — so a still-pending row keeps it.
          const resolved = status === 'pending' && !request.dispatched ? 'queued' : status;
          const error = requestErrorText(row.error);
          if (resolved === request.status && error === request.error) continue;
          next[slug] = { ...request, status: resolved, error };
          changed = true;
        }
        return changed ? next : current;
      });
    };
    void read();
    const timer = setInterval(() => void read(), REQUEST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasRequestInFlight, isMock, assistant]);

  // A settled change makes the optimistic copy obsolete either way: re-read,
  // so what is on screen is the assistant's own installation rows. On failure
  // that is what un-does an install the shelf drew but nobody performed.
  const appliedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const settled = Object.values(requests).filter(
      (request) => isSettled(request) && !appliedRef.current.has(request.requestId)
    );
    if (settled.length === 0) return;
    for (const request of settled) appliedRef.current.add(request.requestId);
    setHasLoaded(false);
  }, [requests]);

  /** Stops showing a settled request — the card returns to its own state. */
  const dismissRequest = React.useCallback(
    (slug: string) =>
      setRequests((current) => {
        if (!current[slug]) return current;
        const next = { ...current };
        delete next[slug];
        return next;
      }),
    []
  );

  /* --- connect loop ------------------------------------------------------- */
  const connect = React.useCallback(
    (canonicalSlug: string) => {
      // The cached definition for this app says "not connected"; the
      // connection that just landed makes that answer stale. Dropping it
      // sends the shelf back for the real one, which is what the drawer
      // already has and the cards behind it did not — the reason a freshly
      // connected app kept reading unconnected until a hard reload.
      forgetRequirementDefinition(canonicalSlug);
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
    [items, forgetRequirementDefinition]
  );

  /* --- install ------------------------------------------------------------ */
  const install = React.useCallback(
    (slug: string, values: WorkflowParamValues, destination: WorkflowDestination) => {
      // The optimistic surface-by-surface list runs while the assistant does
      // the real work, so the wait shows what is landing rather than a spinner.
      setProvisioning({ slug, step: 0, values, destination });
      void request(slug, 'install', { params: values, destination }).then((recorded) => {
        // A write that never landed must stop the list dead. It used to keep
        // ticking off "Planted 2 procedures", "Planted 1 functions" beside a
        // toast saying the change could not be recorded — the screen
        // contradicting itself, and the reassuring half winning.
        if (!recorded) setProvisioning((current) => (current?.slug === slug ? null : current));
      });
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
    // With a backend the assistant's own row is the truth about what landed,
    // and the tracked request is what says when. Stepping a ladder first only
    // delays that truth by 620ms per surface and shows motion that means
    // nothing, so the backend path never enters it.
    if (!isMock) {
      setProvisioning(null);
      return;
    }
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
  }, [provisioning, items, patch, isMock]);

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
    /**
     * True while any required app is still unanswered — the browse page
     * having loaded is not the same as every requirement having a verdict,
     * and rendering "couldn't check this app" in that gap states one it
     * does not have.
     */
    requirementsResolving: !isMock && (!hasLoaded || requirementsResolving),
    provisioning,
    /**
     * The recorded changes this session is watching, keyed by slug. What the
     * assistant is actually doing with each one, not what the shelf hoped.
     */
    requests,
    dismissRequest,
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
