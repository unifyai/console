/**
 * Contact Info E2E — the phone / WhatsApp fields split the number into a
 * country (dial-code) dropdown plus a national-number input. These tests
 * verify that the recombined value sent to the verification endpoint is a
 * correct full E.164 string, so the payload stays identical to the previous
 * single-field behaviour.
 *
 * Run: npx playwright test src/tests/account/contact-info.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, createAccountTest, dbExec } from './helpers';

const user = createTestUser({ name: 'Contact', lastName: 'Info', credits: 5_000 });
const test = createAccountTest(user);

test.afterAll(() => cleanupUser(user.id));

/**
 * Stub the send-verification endpoint and return the phoneNumber the client
 * submitted (i.e. the fully-constructed E.164 string).
 */
async function captureSentNumber(
  page: import('@playwright/test').Page,
  triggerVerify: () => Promise<void>
): Promise<string> {
  let captured = '';
  await page.route('**/api/profile/phone/send-verification', async (route) => {
    const body = route.request().postDataJSON() as { phoneNumber?: string };
    captured = body?.phoneNumber ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ expiresInSeconds: 300 }),
    });
  });

  await triggerVerify();

  await expect.poll(() => captured, { timeout: 10_000 }).not.toBe('');
  await page.unroute('**/api/profile/phone/send-verification');
  return captured;
}

async function selectCountry(page: import('@playwright/test').Page, name: RegExp) {
  await page.getByTestId('phone-country-select').click();
  await page.getByRole('option', { name }).click();
}

test('phone number defaults to +1 and constructs the full E.164 number', async ({
  authedPage: page,
}) => {
  await page.goto('/account?tab=contact-info');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const phoneInput = page.locator('#phone-number-input');
  await expect(phoneInput).toBeVisible({ timeout: 15_000 });

  await phoneInput.fill('5551234567');

  const verifyBtn = page.getByRole('button', { name: 'Verify' }).first();
  await expect(verifyBtn).toBeEnabled({ timeout: 5_000 });

  const sent = await captureSentNumber(page, async () => {
    await verifyBtn.click();
  });

  expect(sent).toBe('+15551234567');
});

test('selecting a country changes the dial code in the constructed number', async ({
  authedPage: page,
}) => {
  await page.goto('/account?tab=contact-info');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const phoneInput = page.locator('#phone-number-input');
  await expect(phoneInput).toBeVisible({ timeout: 15_000 });

  await selectCountry(page, /United Kingdom/);
  await phoneInput.fill('7911123456');

  const verifyBtn = page.getByRole('button', { name: 'Verify' }).first();
  await expect(verifyBtn).toBeEnabled({ timeout: 5_000 });

  const sent = await captureSentNumber(page, async () => {
    await verifyBtn.click();
  });

  expect(sent).toBe('+447911123456');
});

test('a saved E.164 number is split back into country + national parts', async ({
  authedPage: page,
}) => {
  // Seed a German number directly so the page hydrates from it.
  dbExec(`UPDATE "user" SET phone_number = '+4915123456789' WHERE id = '${user.id}'`);

  try {
    await page.goto('/account?tab=contact-info');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const phoneInput = page.locator('#phone-number-input');
    await expect(phoneInput).toBeVisible({ timeout: 15_000 });

    // National part has the +49 dial code stripped off.
    await expect(phoneInput).toHaveValue('15123456789');
    // Country trigger reflects the German dial code.
    await expect(page.getByTestId('phone-country-select')).toContainText('+49');
  } finally {
    dbExec(`UPDATE "user" SET phone_number = NULL WHERE id = '${user.id}'`);
  }
});
