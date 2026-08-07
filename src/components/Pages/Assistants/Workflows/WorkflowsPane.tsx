'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { TabFooter } from '../Common/TabFooter';
import { WorkflowsGalleryShell } from '@/components/Workflows/WorkflowsGalleryShell';
import { WorkflowDetailSheet } from '@/components/Workflows/WorkflowDetailSheet';
import { UninstallWorkflowDialog } from '@/components/Workflows/UninstallWorkflowDialog';
import { WorkflowConnectAppSheet } from './WorkflowConnectAppSheet';
import { WORKFLOW_SURFACES } from '@/components/Workflows/workflowCategories';
import { useWorkflowCatalog } from '@/hooks/Workflows/useWorkflowCatalog';
import { useWorkflowArtifacts } from '@/hooks/Workflows/useWorkflowArtifacts';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import type { Assistant } from '@/types/assistants/assistant';
import type { SecretActions } from '@/types/assistants/secret';
import type { WorkflowSurfaceKind } from '@/types/workflows';

interface WorkflowsPaneProps {
  assistant?: Assistant | null;
  ownerId: string;
  assistantId: string;
  secretActions?: SecretActions;
  isVisible?: boolean;
  isActiveSurface?: boolean;
  canWrite?: boolean;
  /** The team this assistant could install into, once team context is wired. */
  team?: { id: string; name: string; memberCount: number };
}

/**
 * The Workflows destination — install state and settings for curated
 * workflows. The surface owns nothing else: every planted object lives in
 * its ordinary rail section, and the manifest links out there.
 *
 * All catalog state and transitions live in useWorkflowCatalog; this pane
 * owns only overlay state (which sheet or dialog is open) and navigation.
 */
export function WorkflowsPane({
  assistant = null,
  ownerId,
  assistantId,
  secretActions,
  isVisible = true,
  isActiveSurface = true,
  canWrite = true,
  team,
}: WorkflowsPaneProps) {
  const { navigateToAssistants } = useAppShellNavigation();
  const dataEnabled = isVisible && isActiveSurface;

  // Requirement routes resolve against the integrations layer this app
  // already loads — connections and definitions by canonical slug, plus the
  // secrets a native or BYOD-OAuth app is gated on. Never a second copy.
  const integrations = useProviderIntegrationCatalog(assistantId, { enabled: dataEnabled });
  const secrets = useAssistantSecrets(assistantId, ownerId, secretActions as SecretActions, {
    enabled: dataEnabled && !!secretActions,
  });

  // One context, built from what this app already loads. Resolution itself —
  // including fetching definitions for requirement slugs the browse page does
  // not happen to carry — belongs to the catalogue hook, which is the only
  // place that knows which slugs the shelf actually requires.
  const requirementContext = React.useMemo(
    () => ({
      definitionsBySlug: new Map(
        integrations.definitions.map(
          (definition) => [definition.canonicalSlug, definition] as const
        )
      ),
      secretNames: new Set(secrets.secrets.map((secret) => secret.name)),
    }),
    [integrations.definitions, secrets.secrets]
  );

  const catalog = useWorkflowCatalog(assistantId, {
    enabled: dataEnabled,
    assistant,
    requirementContext,
    // Lets the hook fill gaps in the context by slug, for a required app that
    // sorts past the browse page.
    resolveMissingDefinitions: dataEnabled && integrations.hasLoaded && !integrations.isMock,
  });

  const [openSlug, setOpenSlug] = React.useState<string | null>(null);
  const [uninstallSlug, setUninstallSlug] = React.useState<string | null>(null);
  const [connectSlug, setConnectSlug] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{
    kind: WorkflowSurfaceKind;
    name: string;
  } | null>(null);

  const bySlug = (slug: string | null) =>
    catalog.items.find((item) => item.workflow.slug === slug) ?? null;
  const openItem = bySlug(openSlug);

  // Published artifact bodies for the open workflow, so a manifest row can
  // preview in place instead of bouncing the reader to another tab.
  const artifacts = useWorkflowArtifacts(openSlug, { enabled: dataEnabled });
  const previewArtifact = preview
    ? (artifacts.artifacts.find(
        (artifact) => artifact.kind === preview.kind && artifact.name === preview.name
      ) ?? null)
    : null;

  const openSection = React.useCallback(
    (kind: WorkflowSurfaceKind) => {
      navigateToAssistants({ sectionId: WORKFLOW_SURFACES[kind].sectionId });
    },
    [navigateToAssistants]
  );

  const installedCount = catalog.items.filter((item) => item.installation).length;
  const isProvisioningOpen = catalog.provisioning?.slug === openSlug && openSlug !== null;
  const canMutate = canWrite && catalog.canMutate;

  const connectRequirement = React.useMemo(
    () =>
      catalog.items
        .flatMap((item) => item.workflow.requirements)
        .find((requirement) => requirement.canonicalSlug === connectSlug) ?? null,
    [catalog.items, connectSlug]
  );

  // Every connect entry point — card, installed row, requirement checklist,
  // held banner — opens the provider drawer in place; the workflow sheet
  // underneath stays exactly where it was.
  const handleConnected = React.useCallback(
    (canonicalSlug: string) => {
      catalog.connect(canonicalSlug);
      setConnectSlug(null);
    },
    [catalog]
  );

  return (
    <div className="flex h-full flex-col" data-testid="workflows-pane">
      <div className="min-h-0 flex-1">
        <WorkflowsGalleryShell
          items={catalog.items}
          isLoading={catalog.isLoading}
          canMutate={canMutate}
          onRefresh={catalog.refresh}
          onOpen={(item) => setOpenSlug(item.workflow.slug)}
          onInstall={(item) => setOpenSlug(item.workflow.slug)}
          onConnect={setConnectSlug}
          onToggleSetup={catalog.toggleSetup}
          onRetry={catalog.retry}
          renderDetailSheet={() => (
            <>
              <WorkflowDetailSheet
                item={openItem}
                open={!!openItem}
                isLoading={catalog.isLoading}
                canMutate={canMutate}
                team={team}
                isInstalling={isProvisioningOpen}
                provisioningStep={isProvisioningOpen ? catalog.provisioning?.step : 0}
                onOpenChange={(next) => {
                  if (next) return;
                  setOpenSlug(null);
                  setPreview(null);
                }}
                onConnect={(canonicalSlug) => setConnectSlug(canonicalSlug)}
                onInstall={(values, destination) =>
                  openSlug && catalog.install(openSlug, values, destination)
                }
                onSaveParams={catalog.saveParams}
                onUninstall={(item) => setUninstallSlug(item.workflow.slug)}
                onToggleSetup={catalog.toggleSetup}
                onStopSetup={catalog.stopSetup}
                onRetry={catalog.retry}
                onUpdate={catalog.update}
                onNavigate={openSection}
                onPreview={(kind, name) => setPreview({ kind, name })}
                requirementsResolving={!integrations.hasLoaded}
                preview={preview ? previewArtifact : null}
                previewLoading={artifacts.isLoading}
                onPreviewBack={() => setPreview(null)}
                onSupplySecret={(requirement) => {
                  // Secrets are entered on the Integrations surface, so this is
                  // the one requirement route that genuinely lives elsewhere.
                  toast.message(
                    `${requirement.displayName} needs ${(requirement.missingSecrets ?? []).join(', ') || 'a credential'}.`,
                    { description: 'Add it under Integrations, then come back to arm the jobs.' }
                  );
                  navigateToAssistants({ sectionId: 'integrations' });
                }}
                onWatchInActions={() => navigateToAssistants({ sectionId: 'actions' })}
              />
              <UninstallWorkflowDialog
                item={bySlug(uninstallSlug)}
                open={!!uninstallSlug}
                onOpenChange={(next) => !next && setUninstallSlug(null)}
                onConfirm={({ keepData }) => {
                  if (!uninstallSlug) return;
                  catalog.uninstall(uninstallSlug, { keepData });
                  setUninstallSlug(null);
                  setOpenSlug(null);
                }}
              />
              <WorkflowConnectAppSheet
                assistantId={assistantId}
                canonicalSlug={connectSlug}
                displayName={connectRequirement?.displayName ?? null}
                open={!!connectSlug}
                onOpenChange={(next) => !next && setConnectSlug(null)}
                onConnected={handleConnected}
              />
            </>
          )}
        />
      </div>

      <TabFooter
        testId="workflows-footer"
        count={installedCount}
        total={catalog.items.length}
        singular="workflow installed"
        plural="workflows installed"
      />
    </div>
  );
}
