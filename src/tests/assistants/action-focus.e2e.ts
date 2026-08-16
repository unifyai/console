/**
 * Action focus overlay E2E — verifies that a root action in the Actions pane
 * can be:
 *  - blown up into a floating overlay, and closed again
 *  - resized by dragging the overlay's edges
 *  - toggled to fill the viewport and restored
 *  - handed off to a new browser tab, which lands on Actions with the same
 *    action already open
 *
 * Run: npx playwright test src/tests/assistants/action-focus.e2e.ts
 */

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  selectAssistantInList,
  openRailSection,
} from './helpers';
import { railSection } from '../helpers/shell';

const user = createTestUser({ name: 'ActionFocusE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'FocusBot',
  surname: 'E2E',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeds one completed root action so the pane has a card to focus. */
async function seedCompletedRootAction(callingId: string, questionText: string): Promise<void> {
  /* eslint-disable @typescript-eslint/naming-convention */
  const base = {
    calling_id: callingId,
    manager: 'ContactManager',
    method: 'ask',
    hierarchy: ['ContactManager.ask'],
    hierarchy_label: 'ContactManager.ask',
    status: 'ok',
    display_label: 'Looking Up Contact',
    event_timestamp: new Date().toISOString(),
  };
  const entries = [
    { ...base, event_id: `evt-${callingId}-incoming`, phase: 'incoming', question: questionText },
    { ...base, event_id: `evt-${callingId}-outgoing`, phase: 'outgoing', answer: 'Found John Doe' },
  ];
  /* eslint-enable @typescript-eslint/naming-convention */

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${user.id}/${assistant.agentId}/Events/ManagerMethod`,
        entries,
      }),
    },
    user.apiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to seed action: ${res.status} ${await res.text()}`);
  }
}

async function openActionsPane(page: Page): Promise<void> {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // Dismisses the switcher popover on the way out, so the rail is clickable.
  await selectAssistantInList(page, assistant.agentId);
  await page.waitForTimeout(1_500);

  await openRailSection(page, 'actions');
  await expect(railSection(page, 'actions')).toHaveAttribute('aria-current', 'page');

  await expect(page.getByTestId('live-actions-tree-container')).toBeVisible({ timeout: 15_000 });
}

/**
 * The root action card carrying `questionText`. Tests in this file share one
 * assistant, so cards from earlier tests are still in the list — always match
 * on the text this test seeded rather than taking the first card.
 */
function actionCard(page: Page, questionText: string) {
  return page.getByTestId('action-card').filter({ hasText: questionText });
}

/** Opens the focus overlay from the card carrying `questionText`. */
async function focusAction(page: Page, questionText: string): Promise<void> {
  const card = actionCard(page, questionText);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.hover();
  await card.getByTestId('action-focus-button').click();
  await expect(page.getByTestId('action-focus-overlay')).toBeVisible({ timeout: 10_000 });
}

async function overlayBox(page: Page) {
  const box = await page.getByTestId('action-focus-overlay').boundingBox();
  if (!box) throw new Error('Focus overlay has no bounding box');
  return box;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('a root action opens in the focus overlay and closes again @area(assistants.live-actions)', async ({
  authedPage: page,
}) => {
  const callingId = `focus-${Date.now()}`;
  const questionText = `Find John ${callingId}`;
  await seedCompletedRootAction(callingId, questionText);

  await openActionsPane(page);
  await focusAction(page, questionText);

  const overlay = page.getByTestId('action-focus-overlay');
  await expect(overlay.getByText(questionText).first()).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('action-focus-close').click();
  await expect(overlay).toHaveCount(0);
  // The list underneath survives the round trip.
  await expect(page.getByTestId('action-card').first()).toBeVisible();
});

test('dragging the overlay edges resizes it @area(assistants.live-actions)', async ({
  authedPage: page,
}) => {
  const callingId = `resize-${Date.now()}`;
  const questionText = `Find John ${callingId}`;
  await seedCompletedRootAction(callingId, questionText);

  await openActionsPane(page);
  await focusAction(page, questionText);

  const before = await overlayBox(page);

  // Drag the right edge inwards, then the bottom edge upwards.
  const rightHandle = page.getByTestId('action-focus-resize-e');
  const rightBox = await rightHandle.boundingBox();
  if (!rightBox) throw new Error('Right resize handle has no bounding box');
  await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + rightBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(rightBox.x - 200, rightBox.y + rightBox.height / 2, { steps: 10 });
  await page.mouse.up();

  const afterWidth = await overlayBox(page);
  expect(afterWidth.width).toBeLessThan(before.width - 100);
  // The dragged edge moves; the opposite edge stays put.
  expect(Math.abs(afterWidth.x - before.x)).toBeLessThan(4);

  const bottomHandle = page.getByTestId('action-focus-resize-s');
  const bottomBox = await bottomHandle.boundingBox();
  if (!bottomBox) throw new Error('Bottom resize handle has no bounding box');
  await page.mouse.move(bottomBox.x + bottomBox.width / 2, bottomBox.y + bottomBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(bottomBox.x + bottomBox.width / 2, bottomBox.y - 150, { steps: 10 });
  await page.mouse.up();

  const afterHeight = await overlayBox(page);
  expect(afterHeight.height).toBeLessThan(afterWidth.height - 80);
  expect(Math.abs(afterHeight.y - afterWidth.y)).toBeLessThan(4);
});

test('the overlay fills the viewport and restores @area(assistants.live-actions)', async ({
  authedPage: page,
}) => {
  const callingId = `maximize-${Date.now()}`;
  const questionText = `Find John ${callingId}`;
  await seedCompletedRootAction(callingId, questionText);

  await openActionsPane(page);
  await focusAction(page, questionText);

  const overlay = page.getByTestId('action-focus-overlay');
  const restored = await overlayBox(page);

  await page.getByTestId('action-focus-maximize').click();
  await expect(overlay).toHaveAttribute('data-maximized', 'true');

  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport size');
  const maximized = await overlayBox(page);
  expect(maximized.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(maximized.height).toBeGreaterThanOrEqual(viewport.height - 2);

  await page.getByTestId('action-focus-maximize').click();
  await expect(overlay).not.toHaveAttribute('data-maximized', 'true');
  const afterRestore = await overlayBox(page);
  expect(Math.abs(afterRestore.width - restored.width)).toBeLessThan(4);
});

test('an action opens in a new tab already focused @area(assistants.live-actions)', async ({
  authedPage: page,
}) => {
  const callingId = `newtab-${Date.now()}`;
  const questionText = `Find John ${callingId}`;
  await seedCompletedRootAction(callingId, questionText);

  await openActionsPane(page);

  const card = actionCard(page, questionText);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.hover();

  const [newTab] = await Promise.all([
    page.context().waitForEvent('page'),
    card.getByTestId('action-new-tab-button').click(),
  ]);

  await newTab.waitForLoadState('domcontentloaded');
  expect(newTab.url()).toContain(`action=${callingId}`);
  expect(newTab.url()).toContain(`profile=${assistant.agentId}`);

  // The deep link lands on Actions with the overlay already filling the screen.
  await expect(railSection(newTab, 'actions')).toHaveAttribute('aria-current', 'page', {
    timeout: 30_000,
  });
  const overlay = newTab.getByTestId('action-focus-overlay');
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  await expect(overlay).toHaveAttribute('data-maximized', 'true');
  await expect(overlay.getByText(questionText).first()).toBeVisible({ timeout: 10_000 });

  await newTab.close();
});
