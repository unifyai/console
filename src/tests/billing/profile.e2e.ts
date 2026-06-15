/**
 * Billing Profile E2E — open dialog, edit, save, validation, persistence.
 *
 * Run: npx playwright test src/tests/billing/profile.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest, type TestUser } from './helpers';

async function openProfileDialog(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.locator('text=Billing Profile')).toBeVisible({ timeout: 20_000 });

  const editBtn = page.getByRole('button', { name: 'Edit', exact: true });
  await expect(editBtn).toBeVisible({ timeout: 5_000 });
  await editBtn.click();

  await expect(page.locator('text=Edit Billing Profile')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#billingName')).toBeVisible({ timeout: 15_000 });
}

/**
 * Fill the now-required billing-address fields (street line + country) so
 * the form validates and Save enables. Country is a dropdown that stores the
 * ISO-2 code while showing the localized name.
 */
async function fillRequiredAddress(page: Page) {
  await page.locator('#addrLine1').fill('123 Test St');
  await page.locator('#addrCity').fill('San Francisco');
  await page.locator('#addrPostal').fill('94105');
  await page.locator('#addrCountry').click();
  await page.getByRole('option', { name: 'United States' }).click();
}

const user = createTestUser({ name: 'Profile', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('opens and closes the profile dialog via cancel', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  await expect(page.locator('#billingName')).toBeVisible();
  await expect(page.locator('#billingEmail')).toBeVisible();

  await page.locator('button', { hasText: 'Cancel' }).click();
  await expect(page.locator('#billingName')).not.toBeVisible({ timeout: 5_000 });
});

test('save button is disabled when name is empty', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  await page.locator('#billingName').fill('');

  const saveBtn = page.locator('button', { hasText: 'Save Changes' });
  await expect(saveBtn).toBeDisabled({ timeout: 5_000 });
});

test('saves billing name and closes dialog', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  await page.locator('#billingName').fill('Test Business Inc.');
  await page.locator('#billingEmail').fill('billing@test.com');
  await fillRequiredAddress(page);
  await page.locator('button', { hasText: 'Save Changes' }).click();

  await expect(page.locator('#billingName')).not.toBeVisible({ timeout: 15_000 });
});

test('persists saved name across page reloads', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await openProfileDialog(page);

  const uniqueName = `Persistent Biz ${Date.now()}`;
  await page.locator('#billingName').fill(uniqueName);
  await fillRequiredAddress(page);
  await page.locator('button', { hasText: 'Save Changes' }).click();
  await expect(page.locator('#billingName')).not.toBeVisible({ timeout: 15_000 });

  await page.reload();
  await openProfileDialog(page);

  const nameValue = await page.locator('#billingName').inputValue();
  expect(nameValue).toBe(uniqueName);
});
