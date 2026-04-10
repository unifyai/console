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
} from './helpers';

const owner = createTestUser({ name: 'OrgOwner', lastName: 'Mgmt', credits: 5_000 });
const member = createTestUser({ name: 'OrgMember', lastName: 'Mgmt', credits: 5_000 });
const org = createOrg({ name: `MgmtOrg${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });

const test = createAccountTest(owner);
test.setTimeout(90_000);

test.afterAll(() => {
  deleteInvitesByOrg(org.id);
  deleteOrg(org.id);
  cleanupUser(owner.id);
  cleanupUser(member.id);
});

test('members tab shows all members from DB', async ({ authedPage: page }) => {
  await page.goto('/organizations?tab=members');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  await expect(page.locator(`text=${owner.email}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`text=${member.email}`)).toBeVisible({ timeout: 10_000 });

  const memberCount = getOrgMemberCount(org.id);
  expect(memberCount).toBe(2);
});

test('inviting a member via UI creates an invite record in DB', async ({ authedPage: page }) => {
  const inviteEmail = uniqueEmail('invite-ui');

  await page.goto('/organizations?tab=members');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  // Open invite dialog (icon button with aria-label)
  await page.getByRole('button', { name: 'Invite a new member' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Fill email
  await dialog.locator('#email').fill(inviteEmail);

  // Submit invite
  await dialog.getByRole('button', { name: /^Invite$/ }).click();

  // Wait for dialog to close (indicates success)
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // Verify DB has the invite
  const inviteId = getOrgInviteByEmail(org.id, inviteEmail);
  expect(inviteId).toBeTruthy();
});

test('cancelling an invite via UI removes it from DB', async ({ authedPage: page }) => {
  const cancelEmail = uniqueEmail('cancel-ui');

  // Seed an invite via DB (setup, not the action under test)
  const inviteId = `cancel-inv-${Date.now()}`;
  dbExec(
    `INSERT INTO organization_invite (id, organization_id, invitee_email, invited_by_user_id, role_id, token, expires_at) ` +
      `VALUES ('${inviteId}', ${org.id}, '${cancelEmail}', '${owner.id}', ` +
      `(SELECT id FROM role WHERE name = 'Member' AND is_system_role = true LIMIT 1), ` +
      `'cancel-token-${Date.now()}', NOW() + INTERVAL '7 days')`
  );
  expect(getOrgInviteByEmail(org.id, cancelEmail)).toBeTruthy();

  await page.goto('/organizations?tab=members');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  // Find the invite row and open the kebab menu
  const inviteRow = page.locator('tr').filter({ hasText: cancelEmail });
  await expect(inviteRow).toBeVisible({ timeout: 10_000 });
  await inviteRow.getByRole('button', { name: 'Manage member' }).click();

  // Click "Cancel Invite" (no confirmation dialog)
  await page.getByRole('menuitem', { name: 'Cancel Invite' }).click();

  // Wait for row to disappear from the list
  await expect(inviteRow).not.toBeVisible({ timeout: 10_000 });

  // Verify removed from DB
  expect(getOrgInviteByEmail(org.id, cancelEmail)).toBeFalsy();
});

test('updating org name via settings tab persists to DB', async ({ authedPage: page }) => {
  const newName = `UpdatedOrg${Date.now()}`;

  await page.goto('/organizations?tab=organization');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const nameInput = page.locator('#org-name');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  // Clear and type new name
  await nameInput.clear();
  await nameInput.fill(newName);

  // Save (button appears only when form is dirty)
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeVisible({ timeout: 5_000 });
  await saveBtn.click();

  // handleSubmit fires onUpdate without awaiting it, so wait for the
  // server action's own toast which confirms the API call completed.
  await expect(page.locator('text=Organization updated successfully')).toBeVisible({
    timeout: 15_000,
  });

  // Verify DB
  const dbName = getOrgNameById(org.id);
  expect(dbName).toBe(newName);
});

test('removing a member via UI decreases member count in DB', async ({ authedPage: page }) => {
  // Seed a temporary member to remove
  const tempMember = createTestUser({ name: 'Temp', lastName: 'Remove', credits: 100 });
  addMember({ orgId: org.id, userId: tempMember.id, role: 'Member' });

  const countBefore = getOrgMemberCount(org.id);

  await page.goto('/organizations?tab=members');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  // Find the member row and open the kebab menu
  const memberRow = page.locator('tr').filter({ hasText: tempMember.email });
  await expect(memberRow).toBeVisible({ timeout: 10_000 });
  await memberRow.getByRole('button', { name: 'Manage member' }).click();

  // Click "Remove Member" (no confirmation dialog)
  await page.getByRole('menuitem', { name: 'Remove Member' }).click();

  // Wait for row to disappear
  await expect(memberRow).not.toBeVisible({ timeout: 10_000 });

  // Verify DB
  const countAfter = getOrgMemberCount(org.id);
  expect(countAfter).toBe(countBefore - 1);

  cleanupUser(tempMember.id);
});
