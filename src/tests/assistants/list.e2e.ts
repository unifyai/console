/**
 * Assistant List E2E — verifies the assistant list behaves correctly:
 * empty state, list rendering after seeding, clicking to open profile,
 * and list updating after a new hire.
 *
 * Run: npx playwright test src/tests/assistants/list.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openHireDialog,
  openUnitySwitcher,
  selectAssistantInList,
  fillProfileFields,
  selectVoice,
  clickHireButton,
  getAssistantFromDb,
  getCoordinatorAgentId,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'ListE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('the Onboard button opens the hire dialog', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  // Every workspace now has an always-present personal Coordinator, so the list
  // is never truly empty and the legacy "auto-open on empty" path no longer
  // fires. A coordinator-only workspace stays on the onboarding intro, so seed
  // one regular assistant to land on the standard list, then drive the hire
  // dialog from the Onboard button (the surviving user-initiated entry point).
  createAssistant({ userId: user.id, firstName: 'Existing', surname: 'Unity' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await openHireDialog(page);

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole('heading', { name: 'Onboard Unity' })).toBeVisible({
    timeout: 5_000,
  });
});

test('seeded assistants appear in the list with correct names', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);

  const a1 = createAssistant({ userId: user.id, firstName: 'Alpha', surname: 'ListTest' });
  const a2 = createAssistant({ userId: user.id, firstName: 'Beta', surname: 'ListTest' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // The list now lives inside the rail's unity switcher popover.
  await openUnitySwitcher(page);

  const item1 = page.getByTestId(`assistant-list-item-${a1.agentId}`);
  const item2 = page.getByTestId(`assistant-list-item-${a2.agentId}`);

  await expect(item1).toBeVisible({ timeout: 15_000 });
  await expect(item2).toBeVisible({ timeout: 5_000 });

  // Solo assistants (no shared team) must not be bucketed into a team section.
  // The pinned Coordinator group is always present and is expected.
  await expect(page.getByTestId('assistant-list-section-teams')).toHaveCount(0);
  await expect(item1).toContainText('Alpha');
  await expect(item2).toContainText('Beta');
});

test('clicking an assistant in the list selects it and shows the Chat tab', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const seeded = createAssistant({ userId: user.id, firstName: 'Clickable', surname: 'Selectee' });
  const agentId = seeded.agentId;
  const dbAssistant = getAssistantFromDb(agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // Selecting from the switcher opens the unity in the section host with the
  // Chat section active by default (the rail owns section nav now).
  await selectAssistantInList(page, agentId);

  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page', {
    timeout: 10_000,
  });
  await expect(page.locator(`text=${dbAssistant.firstName}`).first()).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator(`text=${dbAssistant.surname}`).first()).toBeVisible({ timeout: 5_000 });
});

// RETIRED (Phase 5 — Hire/onboarding): this journey asserts the legacy
// two-pane model — clicking a selected row to *deselect* it back to a
// ``right-pane-tab-chat`` / "Select a unity…" empty state. Both are gone: the
// rail owns section nav (``rail-section-*``) and the workspace auto-selects the
// personal Coordinator, so a bare list never sits in an empty/deselected state
// and clicking a row only switches selection. The deselect-to-empty behaviour
// no longer exists, so the test stays disabled until/unless that interaction is
// reintroduced under the Coordinator default-selection model.
test.fixme('rapid select/deselect settles on the final click and does not snap back', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const seeded = createAssistant({ userId: user.id, firstName: 'Rapid', surname: 'Toggler' });
  const agentId = seeded.agentId;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  const chatTab = page.getByTestId('right-pane-tab-chat');
  const emptyState = page.locator('text=Select a droid to watch live actions.');

  // Normalise to a known deselected starting point.
  if (await chatTab.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await listItem.click();
    await expect(emptyState).toBeVisible({ timeout: 5_000 });
  }

  // Three back-to-back clicks => the final intent is "selected". The
  // `?profile=` URL sync runs through an async `router.replace`; a stale
  // navigation resolving late must not flip the selection back off.
  await listItem.click();
  await listItem.click();
  await listItem.click();

  await expect(chatTab).toHaveAttribute('data-state', 'active', { timeout: 5_000 });
  // Give any in-flight URL navigations time to resolve, then re-assert the
  // selection held — the regression manifested as a delayed self-undo.
  await page.waitForTimeout(1_500);
  await expect(chatTab).toHaveAttribute('data-state', 'active');

  // Two back-to-back clicks => the final intent is "deselected"; it must
  // stay deselected after the URL round-trip settles.
  await listItem.click();
  await listItem.click();

  await expect(emptyState).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  await expect(emptyState).toBeVisible();
});

test('the chat info side panel can be resized down to its minimum width', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);

  const titled = createAssistant({
    userId: user.id,
    firstName: 'Titled',
    surname: 'InfoPanel',
    jobTitle: 'QA engineer',
  });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await selectAssistantInList(page, titled.agentId);

  // Open the inline info side panel from the chat sub-header. We can't
  // rely on the post-hire auto-open path here because this assistant
  // was seeded via `createAssistant` (no `newlyHiredInfo` in memory).
  const infoButton = page.getByTestId('assistant-info-button');
  await expect(infoButton).toBeVisible({ timeout: 10_000 });

  const infoSheet = page.getByTestId('assistant-info-sheet');
  if (!(await infoSheet.isVisible({ timeout: 1_000 }).catch(() => false))) {
    await infoButton.click();
  }
  await expect(infoSheet).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('assistant-info-name')).toContainText('Titled InfoPanel');

  const resizeHandle = page.getByTestId('assistant-info-panel-resize-handle');
  const beforeBox = await infoSheet.boundingBox();
  const handleBox = await resizeHandle.boundingBox();
  if (!beforeBox || !handleBox) throw new Error('Info panel resize target was not measurable');

  const dragY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(handleBox.x + handleBox.width / 2, dragY);
  await page.mouse.down();
  await page.mouse.move(beforeBox.x + beforeBox.width + 200, dragY, { steps: 12 });
  await page.mouse.up();

  const afterBox = await infoSheet.boundingBox();
  if (!afterBox) throw new Error('Info panel was not measurable after resize');
  expect(afterBox.width).toBeLessThan(beforeBox.width - 40);
  expect(afterBox.width).toBeGreaterThanOrEqual(318);
  expect(afterBox.width).toBeLessThanOrEqual(324);
});

test('list updates after hiring a new assistant without page reload', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  // A regular assistant must exist so the page renders the standard list view
  // (a coordinator-only workspace stays on the onboarding intro).
  createAssistant({ userId: user.id, firstName: 'Baseline', surname: 'Unity' });
  const firstName = `Fresh${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // The list lives inside the rail's unity switcher popover — open it to
  // count visible list items before the hire, then close it (the popover is
  // itself a [role="dialog"], so leaving it open would make openHireDialog
  // think the hire dialog is already up).
  await openUnitySwitcher(page);
  const itemsBefore = await page.locator('[data-testid^="assistant-list-item-"]').count();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await openHireDialog(page);
  await fillProfileFields(page, {
    firstName,
    lastName: 'ListNew',
    about: 'Testing list update after hire.',
  });
  await selectVoice(page);
  await clickHireButton(page);

  // The hire dialog (and the switcher popover) dismiss on submit; reopen the
  // switcher to confirm the freshly hired unity shows without a page reload.
  await openUnitySwitcher(page);
  const newItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(newItem).toBeVisible({ timeout: 60_000 });

  const itemsAfter = await page.locator('[data-testid^="assistant-list-item-"]').count();
  expect(itemsAfter).toBe(itemsBefore + 1);
});
