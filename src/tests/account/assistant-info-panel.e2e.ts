/**
 * Assistant info panel from settings-family routes.
 *
 * The assistants runtime stays mounted while the user is on account/settings
 * pages. The top-nav profile toggle must open the side panel as an overlay
 * without navigating away from the current route.
 *
 * Run: npx playwright test src/tests/account/assistant-info-panel.e2e.ts
 */

import { expect } from '@playwright/test';
import { openAssistantInfoPanel } from '../assistants/helpers';
import { createAccountTest, createTestUser, cleanupUser, navigateToAppShellRoute } from './helpers';
import {
  deferCoordinatorForUser,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';

const user = createTestUser({ name: 'Panel', lastName: 'Overlay', credits: 5_000 });
const test = createAccountTest(user);
test.setTimeout(60_000);

const shellOpts = { userId: user.id, apiKey: user.apiKey };

test.beforeAll(async () => {
  await deferCoordinatorForUser(user.id, user.apiKey);
});

test.afterAll(() => {
  cleanupUser(user.id);
});

test('profile toggle opens assistant info panel overlay on account settings', async ({
  authedPage: page,
}) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await dismissCoordinatorOnboardingIfOpen(page);
  await openAssistantInfoPanel(page);
  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 10_000 });

  await page.goto('/account?tab=profile', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });

  const profileToggle = page.getByTestId('assistant-info-button');
  await expect(profileToggle).toBeVisible({ timeout: 15_000 });
  await profileToggle.click();
  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/account/);
});
