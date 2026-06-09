/**
 * Coordinator onboarding E2E.
 *
 * Verifies the guided alternate view of /assistants rendered while
 * the workspace Coordinator's state is in ``onboarding`` mode:
 *
 *   - The unskippable call-vs-chat picker shows on a fresh visit
 *   - The skip-onboarding affordance is suppressed until the user
 *     has answered the picker
 *   - Choosing "I'd rather chat for now" reveals the chat surface
 *     and exposes the skip affordance
 *   - The picker choice is *not* persisted — reloading mid-flow
 *     returns the user to the picker
 *   - Skipping promotes the workspace Coordinator to ``working`` and
 *     the regular /assistants shell takes over, including after a
 *     reload
 *
 * The tests run serially against a single fresh user because the
 * promotion is one-way per workspace — once promoted, we'd need to
 * provision a new workspace to revisit onboarding.
 *
 * Run: npx playwright test src/tests/assistants/coordinator-onboarding.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createAssistantTest,
  createTestUser,
  cleanupUser,
  deleteAllAssistantsForUser,
} from './helpers';

const user = createTestUser({ name: 'CoordOnboard', lastName: 'E2E', credits: 50_000 });
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  try {
    deleteAllAssistantsForUser(user.id);
  } catch {
    /* best effort */
  }
  cleanupUser(user.id);
});

/**
 * Navigate to /assistants. We deliberately don't reuse
 * ``navigateToAssistants`` from the shared helpers because that
 * helper sets the per-assistant onboarding-roadmap suppression flag,
 * and we want a clean slate for the Coordinator onboarding gate.
 */
async function gotoAssistants(page: Page) {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
}

async function expectPickerVisible(page: Page) {
  await expect(page.getByTestId('coordinator-onboarding-picker')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-start-call')).toBeVisible();
  await expect(page.getByTestId('coordinator-onboarding-pick-chat')).toBeVisible();
}

test('picker shows on first visit and hides the skip affordance', async ({ authedPage: page }) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);

  // The picker is intentionally unskippable: until the user answers
  // call-or-chat there is no Skip button.
  await expect(page.getByTestId('coordinator-onboarding-skip')).toHaveCount(0);
});

test('picking chat reveals the chat surface and the skip affordance', async ({
  authedPage: page,
}) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.getByTestId('coordinator-onboarding-pick-chat').click();

  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('coordinator-onboarding-picker')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-onboarding-skip')).toBeVisible();

  // The chat composer is part of the standard assistant chat panel —
  // its presence is the canonical signal that the chat surface is
  // wired up and ready for input.
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('coordinator-onboarding-item-connect').click();
  await expect(page.getByTestId('coordinator-onboarding-item-workspace')).toHaveAttribute(
    'data-attention',
    'true'
  );
});

test('reloading after picking chat returns the user to the picker', async ({
  authedPage: page,
}) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding-chat')).toBeVisible({
    timeout: 10_000,
  });

  // The picker decision is per-session and never persisted on the
  // Coordinator/State row. A reload mid-flow should drop the user
  // back on the picker so they can re-decide.
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expectPickerVisible(page);
});

test('skipping onboarding swaps in the regular assistants layout', async ({ authedPage: page }) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);

  // Skip requires the picker to be answered first.
  await page.getByTestId('coordinator-onboarding-pick-chat').click();
  await expect(page.getByTestId('coordinator-onboarding-skip')).toBeVisible({
    timeout: 10_000,
  });

  await page.getByTestId('coordinator-onboarding-skip').click();

  // Onboarding view disappears entirely once the promotion lands.
  await expect(page.getByTestId('coordinator-onboarding')).toHaveCount(0, {
    timeout: 15_000,
  });
  // Regular layout's coordinator-divider is the canonical signal of
  // the standard /assistants shell — the divider lives between the
  // pinned coordinator section and the rest of the list, and is
  // only mounted by the non-onboarding view.
  await expect(page.getByTestId('coordinator-divider')).toBeVisible({ timeout: 15_000 });
});

test('the promotion is persistent across reloads', async ({ authedPage: page }) => {
  // Subsequent visits land directly on the regular layout — mode is
  // ``working`` server-side now, so the onboarding gate stays
  // closed even on a cold load.
  await gotoAssistants(page);
  await expect(page.getByTestId('coordinator-onboarding')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('coordinator-divider')).toBeVisible({ timeout: 15_000 });
});
