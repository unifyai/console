'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  MOCK_WORKFLOW_GALLERY_ITEMS,
  shouldUseMockWorkflows,
} from '@/utils/assistants/workflow-mock-data';
import { WORKFLOW_SURFACE_ORDER } from '@/components/Workflows/workflowCategories';
import type { WorkflowParamValues } from '@/components/Workflows/WorkflowParamsForm';
import {
  provisioningTask,
  unmetRequirements,
  type WorkflowDestination,
  type WorkflowGalleryItem,
} from '@/types/workflows';

/** Milliseconds between optimistic provisioning steps while an install plants. */
const PROVISIONING_STEP_MS = 620;

export interface WorkflowProvisioningState {
  slug: string;
  step: number;
  values: WorkflowParamValues;
  destination: WorkflowDestination;
}

interface UseWorkflowCatalogOptions {
  /** Gate fetching to the pane being visible, like the integrations catalog. */
  enabled?: boolean;
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
  const { enabled = true } = options;

  const [items, setItems] = React.useState<WorkflowGalleryItem[]>([]);
  const [isMock, setIsMock] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [provisioning, setProvisioning] = React.useState<WorkflowProvisioningState | null>(null);

  React.useEffect(() => {
    if (!enabled || hasLoaded) return;
    if (shouldUseMockWorkflows()) {
      setItems(MOCK_WORKFLOW_GALLERY_ITEMS);
      setIsMock(true);
      setHasLoaded(true);
      return;
    }
    // Live path: the WorkflowManager catalog feed is not exposed yet, so the
    // shelf resolves empty rather than erroring against a missing endpoint.
    setItems([]);
    setIsMock(false);
    setHasLoaded(true);
  }, [enabled, hasLoaded, assistantId]);

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
