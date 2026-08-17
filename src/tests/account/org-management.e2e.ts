/**
 * Organization Management E2E — members view, invite, cancel invite,
 * update org name, remove member.
 *
 * All mutations go through the actual UI (page actions). DB is used
 * only for seeding prerequisite state and verifying outcomes.
 *
 * Run: npx playwright test src/tests/account/org-management.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  createOrg,
  addMember,
  deleteOrg,
  uniqueEmail,
  dbExec,
  getOrgMemberCount,
  getOrgInviteByEmail,
  getOrgNameById,
  deleteInvitesByOrg,
  openOrganizationsTab,
} from './helpers';
import { deferCoordinatorOnboarding, getCoordinatorAgentId } from '../helpers/coordinator';

const owner = createTestUser({ name: 'OrgOwner', lastName: 'Mgmt', credits: 5_000 });
const member = createTestUser({ name: 'OrgMember', lastName: 'Mgmt', credits: 5_000 });
const org = createOrg({ name: `MgmtOrg${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });

const test = createAccountTest(owner);
test.setTimeout(90_000);

const ownerShellOpts = { userId: owner.id, apiKey: owner.apiKey, orgId: org.id };

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(owner.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(owner.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  deleteInvitesByOrg(org.id);
  deleteOrg(org.id);
  cleanupUser(owner.id);
  cleanupUser(member.id);
});

test('members tab shows all members from DB', async ({ authedPage: page }) => {
  await openOrganizationsTab(page, 'members', ownerShellOpts);

  await expect(page.locator(`text=${owner.email}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`text=${member.email}`)).toBeVisible({ timeout: 10_000 });

  const settingsRail = await page.getByTestId('settings-subrail').boundingBox();
  const organizationRail = await page.getByTestId('organization-subrail').boundingBox();
  expect(settingsRail).not.toBeNull();
  expect(organizationRail).not.toBeNull();
  expect(
    Math.abs(
      organizationRail!.y + organizationRail!.height - (settingsRail!.y + settingsRail!.height)
    )
  ).toBeLessThanOrEqual(2);

  const memberCount = getOrgMemberCount(org.id);
  expect(memberCount).toBe(2);
});

test('inviting a member via UI creates an invite record in DB', async ({ authedPage: page }) => {
  const inviteEmail = uniqueEmail('invite-ui');

  await openOrganizationsTab(page, 'members', ownerShellOpts);

  await page.getByRole('button', { name: 'Invite a new member' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await dialog.locator('#email').fill(inviteEmail);
  await dialog.getByRole('button', { name: /^Invite$/ }).click();

  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  const inviteId = getOrgInviteByEmail(org.id, inviteEmail);
  expect(inviteId).toBeTruthy();
});

test('cancelling an invite via UI removes it from DB', async ({ authedPage: page }) => {
  const cancelEmail = uniqueEmail('cancel-ui');

  const inviteId = `cancel-inv-${Date.now()}`;
  dbExec(
    `INSERT INTO organization_invite (id, organization_id, invitee_email, invited_by_user_id, role_id, token, expires_at) ` +
      `VALUES ('${inviteId}', ${org.id}, '${cancelEmail}', '${owner.id}', ` +
      `(SELECT id FROM role WHERE name = 'Member' AND is_system_role = true LIMIT 1), ` +
      `'cancel-token-${Date.now()}', NOW() + INTERVAL '7 days')`
  );
  expect(getOrgInviteByEmail(org.id, cancelEmail)).toBeTruthy();

  await openOrganizationsTab(page, 'members', ownerShellOpts);

  const inviteRow = page.locator('tr').filter({ hasText: cancelEmail });
  await expect(inviteRow).toBeVisible({ timeout: 10_000 });
  await inviteRow.getByRole('button', { name: 'Manage member' }).click();

  await page.getByRole('menuitem', { name: 'Cancel Invite' }).click();
  await expect(inviteRow).not.toBeVisible({ timeout: 10_000 });

  expect(getOrgInviteByEmail(org.id, cancelEmail)).toBeFalsy();
});

test('updating org name via settings tab persists to DB', async ({ authedPage: page }) => {
  const newName = `UpdatedOrg${Date.now()}`;

  await openOrganizationsTab(page, 'organization', ownerShellOpts);

  const nameInput = page.locator('#org-name');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.clear();
  await nameInput.fill(newName);

  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeVisible({ timeout: 5_000 });
  await saveBtn.click();

  await expect(page.locator('text=Settings saved.')).toBeVisible({
    timeout: 15_000,
  });

  const dbName = getOrgNameById(org.id);
  expect(dbName).toBe(newName);
});

test('removing a member via UI decreases member count in DB', async ({ authedPage: page }) => {
  const tempMember = createTestUser({ name: 'Temp', lastName: 'Remove', credits: 100 });
  addMember({ orgId: org.id, userId: tempMember.id, role: 'Member' });

  const countBefore = getOrgMemberCount(org.id);

  await openOrganizationsTab(page, 'members', ownerShellOpts);

  const memberRow = page.locator('tr').filter({ hasText: tempMember.email });
  await expect(memberRow).toBeVisible({ timeout: 10_000 });
  await memberRow.getByRole('button', { name: 'Manage member' }).click();

  await page.getByRole('menuitem', { name: 'Remove Member' }).click();
  await expect(memberRow).not.toBeVisible({ timeout: 10_000 });

  const countAfter = getOrgMemberCount(org.id);
  expect(countAfter).toBe(countBefore - 1);

  cleanupUser(tempMember.id);
});
