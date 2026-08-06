/**
 * Workflows E2E — the curated shelf as a rail destination. The catalog is the
 * client-side mock (`console:workflows:mock`), so this spec covers the surface
 * journey — rail navigation, install-state rendering, the install and
 * uninstall flows, and the held-connection path — while the WorkflowManager
 * endpoints land. Deep transition logic is pinned by the Vitest suites in
 * src/tests/assistants/{useWorkflowCatalog,workflowsGalleryShell,workflowsPane}.node.test.tsx.
 *
 * Run: npx playwright test src/tests/assistants/workflows.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  openRailSection,
} from './helpers';
import { railSection } from '../helpers/shell';

const user = createTestUser({ name: 'WorkflowsE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Flowy',
  surname: 'E2E',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

async function openWorkflowsSection(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('console:workflows:mock', 'true');
    window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
  });
  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await closeHireDialogIfOpen(page);

  await openRailSection(page, 'workflows');
  await expect(railSection(page, 'workflows')).toHaveAttribute('aria-current', 'page');

  await expect(page.getByTestId('workflows-pane')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('workflow-gallery')).toBeVisible({ timeout: 10_000 });
}

test('workflows rail section opens the shelf and installs a curated workflow @critical @area(assistants.workflows)', async ({
  authedPage: page,
}) => {
  await openWorkflowsSection(page);

  // Installed is the landing segment, sorted attention-first: the partial
  // install outranks the held one, which outranks everything active.
  const firstRow = page.locator('[data-testid^="installed-workflow-"]').first();
  await expect(firstRow).toHaveAttribute('data-testid', 'installed-workflow-invoice-reconcile');
  await expect(page.getByTestId('installed-workflow-daily-briefing')).toBeVisible();
  await expect(
    page.getByTestId('installed-workflow-daily-briefing').getByTestId('workflow-status-active')
  ).toBeVisible();
  await expect(page.getByTestId('workflow-attention-count')).toContainText('2 need attention');

  // Browse the shelf and open a workflow whose requirements are all met.
  await page.getByTestId('workflow-tab-browse').click();
  await expect(page.getByTestId('workflow-card-ship-prs')).toBeVisible();
  await page.getByTestId('workflow-card-install-ship-prs').click();

  const sheet = page.getByTestId('workflow-sheet-ship-prs');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('workflow-install-ship-prs')).toBeEnabled();

  // Install: the optimistic provisioning list ticks through each surface,
  // then the sheet settles into manage mode with the workflow active.
  await sheet.getByTestId('workflow-install-ship-prs').click();
  await expect(sheet.getByTestId('workflow-status-active')).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByTestId('workflow-uninstall-ship-prs')).toBeVisible();

  // Footer reflects the new install.
  await expect(page.getByTestId('workflows-footer')).toContainText('6 of 12 workflows installed');

  // Uninstall names the recurring job before anything is destroyed.
  await sheet.getByTestId('workflow-uninstall-ship-prs').click();
  const dialog = page.getByTestId('uninstall-workflow-ship-prs');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('These stop firing');
  await expect(dialog).toContainText('Pick up ready tickets');
  await dialog.getByRole('button', { name: 'Uninstall' }).click();

  await expect(page.getByTestId('workflow-card-install-ship-prs')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('workflows-footer')).toContainText('5 of 12 workflows installed');
});

test('a held workflow surfaces the connection it is waiting on and arms when it lands @area(assistants.workflows)', async ({
  authedPage: page,
}) => {
  await openWorkflowsSection(page);

  const heldRow = page.getByTestId('installed-workflow-friday-inbox-cleanup');
  await expect(heldRow).toBeVisible();
  await expect(heldRow.getByTestId('workflow-status-pending_requirements')).toBeVisible();
  await expect(heldRow).toContainText('Jobs planted and held until Notion is connected');

  // The one inline action a held row offers is the missing connection. It
  // resolves in place — the shelf stays mounted, the rail never moves.
  await heldRow.getByRole('button', { name: /Connect Notion/ }).click();

  await expect(page.getByTestId('workflows-pane')).toBeVisible();
  await expect(railSection(page, 'workflows')).toHaveAttribute('aria-current', 'page');

  await expect(heldRow.getByTestId('workflow-status-active')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('workflow-attention-count')).toContainText('1 need attention');
});
