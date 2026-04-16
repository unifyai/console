/**
 * Shared Playwright helpers for account & workspace E2E tests.
 *
 * Same pattern as billing/helpers.ts: one seeded user per file,
 * `createAccountTest(user)` gives an `authedPage` fixture that logs in
 * once and reuses the session for every test.
 */

import { test as base, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  login,
  loginAndWaitForRedirect,
  loginAndNavigateTo,
  switchToEmailTab,
} from '../auth/helpers';

export { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
export type { TestUser } from '../helpers/e2e-helpers';

export {
  uniqueEmail,
  dbExec,
  dbExecBlock,
  createUser,
  createOrg,
  deleteOrg,
  addMember,
  orchestraFetch,
} from '../helpers/seeds/client';
export type { SeededOrg } from '../helpers/seeds/types';

export { login, loginAndNavigateTo, switchToEmailTab };

// =============================================================================
// Shared Auth — storageState
// =============================================================================

export async function loginAndSaveState(
  browser: Browser,
  email: string,
  password: string
): Promise<string> {
  const stateFile = path.join(os.tmpdir(), `pw-account-${email.replace(/[^a-z0-9]/gi, '-')}.json`);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 45_000);

  if (page.url().includes('/login/onboarding')) {
    const personalBtn = page.getByTestId('workspace-personal');
    if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await personalBtn.click();
      await page.getByTestId('workspace-continue').click();
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    } else {
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    }
  }

  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

// =============================================================================
// Fixture: createAccountTest
// =============================================================================

export function createAccountTest(user: { email: string; password: string }) {
  let authFile: string | undefined;

  return base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use, testInfo) => {
      if (!authFile) {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        authFile = await loginAndSaveState(browser, user.email, user.password);
      }
      const ctx = await browser.newContext({ storageState: authFile });
      const page = await ctx.newPage();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(page);
      await ctx.close();
    },
  });
}

// =============================================================================
// DB Query Helpers
// =============================================================================

import { dbExec } from '../helpers/seeds/client';

export function getUserFromDb(userId: string) {
  const row = dbExec(
    `SELECT name, last_name, email, timezone, monthly_spending_cap FROM "user" WHERE id = '${userId}'`
  );
  const [name, lastName, email, timezone, spendingCap] = row.split('|');
  return { name, lastName, email, timezone, spendingCap: spendingCap || null };
}

export function getUserApiKeyFromDb(userId: string, orgId?: number): string {
  const sql = orgId
    ? `SELECT key FROM api_key WHERE user_id = '${userId}' AND organization_id = ${orgId} LIMIT 1`
    : `SELECT key FROM api_key WHERE user_id = '${userId}' AND organization_id IS NULL LIMIT 1`;
  return dbExec(sql);
}

export function getOrgFromDb(orgId: number) {
  const row = dbExec(`SELECT name, owner_id FROM organization WHERE id = ${orgId}`);
  const [name, ownerId] = row.split('|');
  return { name, ownerId };
}

export function getOrgMemberCount(orgId: number): number {
  return parseInt(
    dbExec(`SELECT count(*) FROM organization_member WHERE organization_id = ${orgId}`),
    10
  );
}

export function getOrgInviteByEmail(orgId: number, email: string): string | null {
  const result = dbExec(
    `SELECT id FROM organization_invite WHERE organization_id = ${orgId} AND invitee_email = '${email}'`
  );
  return result || null;
}

export function getTeamByName(orgId: number, name: string): number | null {
  const result = dbExec(
    `SELECT id FROM team WHERE organization_id = ${orgId} AND name = '${name}'`
  );
  return result ? parseInt(result, 10) : null;
}

export function getTeamMemberCount(teamId: number): number {
  return parseInt(dbExec(`SELECT count(*) FROM team_member WHERE team_id = ${teamId}`), 10);
}

export function getCustomRoleByName(orgId: number, name: string): number | null {
  const result = dbExec(
    `SELECT id FROM role WHERE organization_id = ${orgId} AND name = '${name}' AND is_system_role = false`
  );
  return result ? parseInt(result, 10) : null;
}

export function getOrgIdByOwner(ownerId: string): number | null {
  const result = dbExec(
    `SELECT id FROM organization WHERE owner_id = '${ownerId}' ORDER BY id DESC LIMIT 1`
  );
  return result ? parseInt(result, 10) : null;
}

export function getOrgNameById(orgId: number): string {
  return dbExec(`SELECT name FROM organization WHERE id = ${orgId}`);
}

export function getUserSpendingCap(userId: string): number | null {
  const result = dbExec(`SELECT monthly_spending_cap FROM "user" WHERE id = '${userId}'`);
  return result ? parseFloat(result) : null;
}

export function deleteInvitesByOrg(orgId: number): void {
  dbExec(`DELETE FROM organization_invite WHERE organization_id = ${orgId}`);
}
