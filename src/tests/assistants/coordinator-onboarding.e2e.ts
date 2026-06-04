/**
 * Coordinator onboarding E2E.
 *
 * Verifies the guided alternate view of /assistants rendered while
 * the workspace Coordinator's state is in ``onboarding`` mode:
 *
 *   - The unskippable call picker shows on a fresh visit
 *   - The picker explains that screen sharing is required
 *   - The old chat-only onboarding path is not available
 *   - Reloading before starting the call returns the user to the picker
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
  await expect(page.getByTestId('coordinator-onboarding-pick-chat')).toHaveCount(0);
}

test('picker shows on first visit and hides the skip affordance', async ({ authedPage: page }) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);

  // The picker is intentionally unskippable: until the required
  // onboarding call starts there is no Skip button.
  await expect(page.getByTestId('coordinator-onboarding-skip')).toHaveCount(0);
});

test('picker explains that screen sharing is required', async ({ authedPage: page }) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await expect(page.getByText('Screen sharing is required')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start onboarding call' })).toBeVisible();
});

test('reloading before starting the call returns the user to the picker', async ({
  authedPage: page,
}) => {
  await gotoAssistants(page);
  await expectPickerVisible(page);

  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expectPickerVisible(page);
});
