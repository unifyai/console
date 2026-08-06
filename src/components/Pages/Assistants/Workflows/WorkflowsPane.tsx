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
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import type { WorkflowSurfaceKind } from '@/types/workflows';

interface WorkflowsPaneProps {
  ownerId: string;
  assistantId: string;
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
  assistantId,
  isVisible = true,
  isActiveSurface = true,
  team,
}: WorkflowsPaneProps) {
  const { navigateToAssistants } = useAppShellNavigation();
  const catalog = useWorkflowCatalog(assistantId, {
    enabled: isVisible && isActiveSurface,
  });

  const [openSlug, setOpenSlug] = React.useState<string | null>(null);
  const [uninstallSlug, setUninstallSlug] = React.useState<string | null>(null);
  const [connectSlug, setConnectSlug] = React.useState<string | null>(null);

  const bySlug = (slug: string | null) =>
    catalog.items.find((item) => item.workflow.slug === slug) ?? null;
  const openItem = bySlug(openSlug);

  const openSection = React.useCallback(
    (kind: WorkflowSurfaceKind) => {
      navigateToAssistants({ sectionId: WORKFLOW_SURFACES[kind].sectionId });
    },
    [navigateToAssistants]
  );

  const installedCount = catalog.items.filter((item) => item.installation).length;
  const isProvisioningOpen = catalog.provisioning?.slug === openSlug && openSlug !== null;

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
                team={team}
                isInstalling={isProvisioningOpen}
                provisioningStep={isProvisioningOpen ? catalog.provisioning?.step : 0}
                onOpenChange={(next) => !next && setOpenSlug(null)}
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
