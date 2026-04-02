/**
 * Invite Acceptance E2E — accept org invite, missing token, unauthenticated
 * redirect, legacy /invite redirect.
 *
 * Run: npx playwright test src/tests/auth/invite.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createInviteToken,
  loginAndNavigateTo,
  login,
  switchToEmailTab,
  createUser,
  createOrg,
  createEmailLogin,
  deleteOrg,
  dbExec,
  uniqueEmail,
  type TestUser,
  type SeededOrg,
} from './helpers';

test.describe('Invite Acceptance', () => {
  let orgOwner: TestUser;
  let org: SeededOrg;
  const cleanupIds: string[] = [];
  let orgId: number;

  test.beforeAll(async () => {
    const owner = createUser({ name: 'Org', lastName: 'Owner' });
    createEmailLogin({ userId: owner.id });
    orgOwner = { ...owner, password: 'testpass123' };
    cleanupIds.push(orgOwner.id);

    org = createOrg({ ownerId: orgOwner.id, name: 'E2E Invite Org' });
    orgId = org.id;
  });

  test.afterAll(() => {
    deleteOrg(orgId);
    for (const id of cleanupIds) {
      cleanupUser(id);
    }
  });

  test('accepts invite and redirects to assistants', async ({ page }) => {
    const invitee = createTestUser({ name: 'Invite', lastName: 'Accepter' });
    cleanupIds.push(invitee.id);

    const token = await createInviteToken(org.ownerOrgApiKey, orgId, invitee.email);

    await loginAndNavigateTo(page, invitee.email, invitee.password, `/login/invite?token=${token}`);

    // Invite auto-processes on mount — wait for success or get-started
    await expect(page.getByTestId('get-started-btn')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('get-started-btn').click();

    await page.waitForURL((url) => !url.pathname.includes('/login/invite'), { timeout: 15000 });

    const isMember = dbExec(
      `SELECT count(*) FROM organization_member WHERE organization_id = ${orgId} AND user_id = '${invitee.id}'`
    );
    expect(isMember).not.toBe('0');
  });

  test('shows error when invite token is missing', async ({ page }) => {
    const invitee = createTestUser({ name: 'No', lastName: 'Token' });
    cleanupIds.push(invitee.id);

    await loginAndNavigateTo(page, invitee.email, invitee.password, '/login/invite');

    await expect(page.getByText('Invalid Invitation')).toBeVisible({ timeout: 10000 });
  });

  test('redirects unauthenticated user to login with invite context', async ({ page }) => {
    const inviteeEmail = uniqueEmail('invite-noauth');
    const token = await createInviteToken(org.ownerOrgApiKey, orgId, inviteeEmail);

    await page.goto(`/login/invite?token=${token}`);

    // NextAuth middleware redirects unauthenticated users to /login with callbackUrl
    await page.waitForURL(/\/login/, { timeout: 10000 });
    const url = page.url();
    expect(url).toMatch(/callbackUrl.*invite|invite=/);

    await expect(page.getByTestId('invite-banner')).toBeVisible({ timeout: 5000 });

    dbExec(`DELETE FROM organization_invite WHERE token = '${token}'`);
  });

  test('shows invite banner on login page when invite token is present', async ({ page }) => {
    const inviteeEmail = uniqueEmail('invite-banner');
    const token = await createInviteToken(org.ownerOrgApiKey, orgId, inviteeEmail);

    await page.goto(`/login?invite=${token}`);

    await expect(page.getByTestId('invite-banner')).toBeVisible({ timeout: 5000 });
    const bannerText = await page.getByTestId('invite-banner').textContent();
    expect(bannerText).toMatch(/invited.*organization/i);

    dbExec(`DELETE FROM organization_invite WHERE token = '${token}'`);
  });

  test('legacy /invite redirects to /login/invite', async ({ page }) => {
    const inviteeEmail = uniqueEmail('invite-legacy');
    const token = await createInviteToken(org.ownerOrgApiKey, orgId, inviteeEmail);

    await page.goto(`/invite?token=${token}`);

    // Should redirect to /login/invite (or /login for auth)
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });

    dbExec(`DELETE FROM organization_invite WHERE token = '${token}'`);
  });
});
