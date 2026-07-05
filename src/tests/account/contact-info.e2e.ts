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
import { enterVerificationCode } from '@/tests/auth/helpers';
import { createTestUser, cleanupUser, createAccountTest, dbExec } from './helpers';

const user = createTestUser({ name: 'Contact', lastName: 'Info', credits: 5_000 });
const test = createAccountTest(user);

test.afterAll(() => cleanupUser(user.id));

function deferredVoid(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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

async function selectCountry(page: import('@playwright/test').Page, query: string) {
  await page.getByTestId('phone-country-select').click();
  await page.getByPlaceholder('Search country or code…').fill(query);
  await page.getByRole('option', { name: new RegExp(query, 'i') }).click();
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

  await selectCountry(page, 'United Kingdom');
  await phoneInput.fill('7911123456');

  const verifyBtn = page.getByRole('button', { name: 'Verify' }).first();
  await expect(verifyBtn).toBeEnabled({ timeout: 5_000 });

  const sent = await captureSentNumber(page, async () => {
    await verifyBtn.click();
  });

  expect(sent).toBe('+447911123456');
});

test('verifying a number eagerly persists it with no Save button', async ({ authedPage: page }) => {
  // The full verify flow can't run end-to-end locally (no Twilio creds), so we
  // stub the verification round-trip and capture the eager profile write that
  // the client fires the moment verification succeeds. This is the exact bug
  // the eager-save redesign fixes: a verified number must persist immediately,
  // not wait for a separate Save click.
  await page.goto('/account?tab=contact-info');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  await page.route('**/api/profile/phone/send-verification', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ expiresInSeconds: 300 }),
    })
  );
  await page.route('**/api/profile/phone/confirm-verification', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'ok', success: true }),
    })
  );

  const saveCanFinish = deferredVoid();
  const saveStarted = deferredVoid();
  let savedPayload: { phoneNumber?: string } | null = null;
  await page.route('**/api/user/update-profile', async (route) => {
    savedPayload = route.request().postDataJSON() as { phoneNumber?: string };
    saveStarted.resolve();
    await saveCanFinish.promise;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  const phoneInput = page.locator('#phone-number-input');
  await expect(phoneInput).toBeVisible({ timeout: 15_000 });
  await phoneInput.fill('5551234567');

  await page.getByRole('button', { name: 'Verify' }).first().click();

  await expect(page.getByTestId('six-digit-code-input')).toBeVisible({ timeout: 10_000 });
  await enterVerificationCode(page, '123456');

  // Verification triggers persistence with the full E.164 number, but the UI must
  // wait for that write to complete before presenting the number as verified.
  await saveStarted.promise;
  await expect.poll(() => savedPayload?.phoneNumber, { timeout: 10_000 }).toBe('+15551234567');
  await expect(page.getByRole('button', { name: 'Verified' })).toHaveCount(0);

  saveCanFinish.resolve();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verified' })).toBeVisible();
});

test('Discord ID auto-saves to the database on blur', async ({ authedPage: page }) => {
  const discord = `9${`${Date.now()}`.slice(-17)}`;

  await page.goto('/account?tab=contact-info');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const discordInput = page.getByPlaceholder('e.g., 123456789012345678');
  await expect(discordInput).toBeVisible({ timeout: 15_000 });

  await discordInput.fill(discord);
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/user/update-profile') && resp.status() === 200,
      { timeout: 15_000 }
    ),
    discordInput.blur(),
  ]);
  await page.waitForTimeout(500);

  try {
    expect(dbExec(`SELECT discord_id FROM "user" WHERE id = '${user.id}'`)).toBe(discord);
  } finally {
    dbExec(`UPDATE "user" SET discord_id = NULL WHERE id = '${user.id}'`);
  }
});

test('removing a saved number clears it from the database eagerly', async ({
  authedPage: page,
}) => {
  dbExec(`UPDATE "user" SET phone_number = '+15125551234' WHERE id = '${user.id}'`);

  try {
    await page.goto('/account?tab=contact-info');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const removeBtn = page.getByRole('button', { name: 'Remove' }).first();
    await expect(removeBtn).toBeVisible({ timeout: 15_000 });

    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/user/update-profile') && resp.status() === 200,
        { timeout: 15_000 }
      ),
      removeBtn.click(),
    ]);
    await page.waitForTimeout(500);

    expect(dbExec(`SELECT phone_number FROM "user" WHERE id = '${user.id}'`)).toBe('');
  } finally {
    dbExec(`UPDATE "user" SET phone_number = NULL WHERE id = '${user.id}'`);
  }
});

test('clicking Verify again while the code section is open does not collapse it', async ({
  authedPage: page,
}) => {
  test.setTimeout(120_000);
  dbExec(`UPDATE "user" SET phone_number = NULL WHERE id = '${user.id}'`);

  await page.goto('/account?tab=contact-info');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  await page.route('**/api/profile/phone/send-verification', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ expiresInSeconds: 300 }),
    })
  );

  const phoneInput = page.locator('#phone-number-input');
  await expect(phoneInput).toBeVisible({ timeout: 15_000 });
  await phoneInput.fill('5551234567');

  await page.getByRole('button', { name: 'Verify' }).first().click();

  await expect(page.getByTestId('six-digit-code-input')).toBeVisible({ timeout: 10_000 });
  const resendBtn = page.getByRole('button', { name: /Resend/ });
  await expect(resendBtn).toBeVisible();

  await expect(resendBtn).toBeEnabled({ timeout: 65_000 });
  await resendBtn.click();
  await expect(page.getByTestId('six-digit-code-input')).toBeVisible();
  await expect(resendBtn).toBeVisible();
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
