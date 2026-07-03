/**
 * Subscription E2E — subscribed billing view smoke (API contract lives in billing-api).
 *
 * Run: npx playwright test src/tests/billing/subscribe.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  skipIfManualTopupBilling,
  subscribeUserToTier,
} from './helpers';

const user = createTestUser({ name: 'Subscribe', lastName: 'Test', credits: 50 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('subscribed account shows current tier and allowance meter @critical @area(billing.subscription)', async ({
  authedPage: page,
}) => {
  await skipIfManualTopupBilling(test, page);
  subscribeUserToTier(user.id, { tierName: 'tier_50', credits: 42 });

  await page.goto('/billing');
  await expect(page.getByTestId('plans-section')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('current-tier-name')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('credits-remaining')).toBeVisible();
  await expect(page.getByTestId('choose-plan-card')).toHaveCount(0);
});
