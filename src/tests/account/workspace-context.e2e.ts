/**
 * Workspace Context E2E — switching workspace via API, verifying context
 * changes affect API responses, cookie persistence.
 *
 * Run: npx playwright test src/tests/account/workspace-context.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  createOrg,
  createAssistant,
  deleteOrg,
  getUserApiKeyFromDb,
  dbExec,
} from './helpers';

const user = createTestUser({ name: 'WsCtx', lastName: 'Test', credits: 5_000 });
const org = createOrg({ name: `WsOrg-${user.id}`, ownerId: user.id });
const lockedOrgAssistant = createAssistant({
  userId: user.id,
  orgId: org.id,
  firstName: 'Locked',
  surname: 'Workspace',
});

const test = createAccountTest(user);
test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test.afterAll(() => {
  deleteOrg(org.id);
  cleanupUser(user.id);
});

test('switching workspace via API changes the session context', async ({ authedPage: page }) => {
  const personalKey = getUserApiKeyFromDb(user.id);
  const orgKey = getUserApiKeyFromDb(user.id, org.id);

  expect(personalKey).toBeTruthy();
  expect(orgKey).toBeTruthy();
  expect(personalKey).not.toBe(orgKey);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  // Switch to personal workspace from the browser context so cookies apply
  const switchStatus = await page.evaluate(async () => {
    const res = await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'personal' }),
    });
    return res.status;
  });
  expect(switchStatus).toBe(200);

  // Verify the session API responds
  const sessionStatus = await page.evaluate(async () => {
    const res = await fetch('/api/session');
    return res.status;
  });
  expect(sessionStatus).toBe(200);
});

test('workspace cookie persists across page reloads', async ({ authedPage: page }) => {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  // Switch to personal from browser context (cookies apply to browser)
  const switchRes = await page.evaluate(async () => {
    const res = await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'personal' }),
    });
    return res.status;
  });
  expect(switchRes).toBe(200);

  // Navigate fresh instead of reload to avoid net::ERR_ABORTED
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const cookies = await page.context().cookies();
  const wsCookie = cookies.find((c) => c.name === 'unify_workspace_id');
  expect(wsCookie).toBeTruthy();
  expect(wsCookie!.value).toBe('personal');
});

test('switching to org workspace and fetching billing returns org credits', async ({
  authedPage: page,
}) => {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const orgId = org.id;

  // Switch to org workspace
  const switchStatus = await page.evaluate(async (oId: number) => {
    const res = await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: String(oId) }),
    });
    return res.status;
  }, orgId);
  expect(switchStatus).toBe(200);

  // Fetch billing balance — should reflect org billing account
  const balance = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    if (!res.ok) return null;
    const data = await res.json();
    return data.balance;
  });

  expect(balance).toBeTruthy();

  const orgCredits = dbExec(
    `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM organization WHERE id = ${orgId})`
  );
  expect(parseFloat(balance)).toBeCloseTo(parseFloat(orgCredits), 0);
});

test('locked org users still see org assistants even with a personal workspace cookie', async ({
  authedPage: page,
}) => {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const switchRes = await page.evaluate(async () => {
    const res = await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'personal' }),
    });
    return res.status;
  });
  expect(switchRes).toBe(200);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const cookies = await page.context().cookies();
  const wsCookie = cookies.find((c) => c.name === 'unify_workspace_id');
  expect(wsCookie?.value).toBe('personal');

  await expect(
    page.getByText(`${lockedOrgAssistant.firstName} ${lockedOrgAssistant.surname}`)
  ).toBeVisible({ timeout: 10_000 });
});
