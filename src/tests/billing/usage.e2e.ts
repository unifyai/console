/**
 * Usage Page E2E — ledger accuracy and auth redirect.
 *
 * Run: npx playwright test src/tests/billing/usage.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  dbExecBlock,
  dbExec,
  type TestUser,
} from './helpers';

function getBillingAccountId(userId: string): number {
  return parseInt(dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${userId}'`), 10);
}

function seedTransaction(opts: {
  baId: number;
  userId: string;
  amount: number;
  category: string;
  description: string;
  minutesAgo?: number;
}) {
  const ago = opts.minutesAgo ?? 5;
  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO credit_transaction
    (billing_account_id, user_id, amount, category, description, at)
  VALUES
    (${opts.baId}, '${opts.userId}', ${opts.amount}, '${opts.category}', '${opts.description}',
     NOW() - INTERVAL '${ago} minutes');
END
\\$\\$;
`);
}

function cleanupTransactions(baId: number) {
  try {
    dbExec(`DELETE FROM credit_transaction WHERE billing_account_id = ${baId}`);
  } catch {
    /* best effort */
  }
}

const user = createTestUser({ name: 'Usage', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

let baId: number;

test.beforeAll(() => {
  baId = getBillingAccountId(user.id);
  cleanupTransactions(baId);

  seedTransaction({
    baId,
    userId: user.id,
    amount: -0.12,
    category: 'llm',
    description: 'Assistant work',
    minutesAgo: 10,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -0.08,
    category: 'llm',
    description: 'Assistant work',
    minutesAgo: 8,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -10,
    category: 'hire',
    description: 'Assistant creation',
    minutesAgo: 6,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -2,
    category: 'resources',
    description: 'Contact provisioning',
    minutesAgo: 4,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -0.5,
    category: 'media',
    description: 'Photo generation',
    minutesAgo: 2,
  });
});

test.afterAll(() => {
  cleanupTransactions(baId);
  cleanupUser(user.id);
});

test('ledger displays seeded transactions with correct category descriptions @critical @area(billing.usage)', async ({
  authedPage: page,
}) => {
  await page.goto('/usage');
  await expect(page.getByTestId('transaction-ledger')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 10_000 });

  const ledger = page.getByTestId('transaction-ledger');
  await expect(ledger.getByText('Assistant work').first()).toBeVisible();
  await expect(ledger.getByText('Assistant creation')).toBeVisible();
  await expect(ledger.getByText('Created and provisioned contacts')).toBeVisible();
  await expect(ledger.getByText('Generated photos and videos')).toBeVisible();
});

unauthTest(
  'redirects to login when not authenticated @critical @area(billing.usage)',
  async ({ page }) => {
    await page.goto('/usage');
    await page.waitForURL('**/login**', { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  }
);
