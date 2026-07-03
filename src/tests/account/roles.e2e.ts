/**
 * Custom Role Management E2E — create role (with permissions), manage
 * permissions, delete role.
 *
 * All mutations go through the actual UI (page actions). DB is used
 * only for seeding prerequisite state and verifying outcomes.
 *
 * Run: npx playwright test src/tests/account/roles.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  createOrg,
  deleteOrg,
  dbExec,
  getCustomRoleByName,
  openOrganizationsTab,
} from './helpers';
import { deferCoordinatorOnboarding, getCoordinatorAgentId } from '../helpers/coordinator';

const owner = createTestUser({ name: 'RoleOwner', lastName: 'Test', credits: 5_000 });
const org = createOrg({ name: `RoleOrg${Date.now()}`, ownerId: owner.id });

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
  deleteOrg(org.id);
  cleanupUser(owner.id);
});

test('creating a custom role via UI persists it in the database', async ({ authedPage: page }) => {
  const roleName = `CustomRole${Date.now()}`;

  await openOrganizationsTab(page, 'roles', ownerShellOpts);
  await expect(page.getByTestId('role-list-panel')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Create new role' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await dialog.getByPlaceholder('Role Name').fill(roleName);

  const firstCheckbox = dialog.getByRole('checkbox').first();
  if (await firstCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstCheckbox.click();
  }

  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  const roleId = getCustomRoleByName(org.id, roleName);
  expect(roleId).toBeTruthy();

  await expect(page.locator(`text=${roleName}`)).toBeVisible({ timeout: 10_000 });
});

test('managing permissions on a custom role via UI persists changes', async ({
  authedPage: page,
}) => {
  const roleName = `PermRole${Date.now()}`;
  dbExec(
    `INSERT INTO role (name, description, organization_id, is_system_role) ` +
      `VALUES ('${roleName}', 'test', ${org.id}, false)`
  );
  const roleId = getCustomRoleByName(org.id, roleName);
  expect(roleId).toBeTruthy();

  const permCountBefore = parseInt(
    dbExec(`SELECT count(*) FROM role_permission WHERE role_id = ${roleId}`),
    10
  );

  await openOrganizationsTab(page, 'roles', ownerShellOpts);
  await expect(page.getByTestId('role-list-panel')).toBeVisible({ timeout: 15_000 });

  const roleRow = page.locator('tr').filter({ hasText: roleName });
  await expect(roleRow).toBeVisible({ timeout: 10_000 });
  await roleRow.getByRole('button', { name: 'More role' }).click();

  await page.getByRole('menuitem', { name: 'Manage Permissions' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  const selectTrigger = dialog.locator('[role="combobox"]');
  await expect(selectTrigger).toBeVisible({ timeout: 5_000 });
  await selectTrigger.click();

  const firstOption = page.getByRole('option').first();
  await expect(firstOption).toBeVisible({ timeout: 5_000 });
  await firstOption.click();

  await dialog.getByRole('button', { name: 'Add' }).click();
  await page.waitForTimeout(2_000);

  const permCountAfter = parseInt(
    dbExec(`SELECT count(*) FROM role_permission WHERE role_id = ${roleId}`),
    10
  );
  expect(permCountAfter).toBeGreaterThan(permCountBefore);
});

test('deleting a custom role via UI removes it from the database', async ({ authedPage: page }) => {
  const roleName = `DelRole${Date.now()}`;
  dbExec(
    `INSERT INTO role (name, description, organization_id, is_system_role) ` +
      `VALUES ('${roleName}', 'test', ${org.id}, false)`
  );
  expect(getCustomRoleByName(org.id, roleName)).toBeTruthy();

  await openOrganizationsTab(page, 'roles', ownerShellOpts);
  await expect(page.getByTestId('role-list-panel')).toBeVisible({ timeout: 15_000 });

  const roleRow = page.locator('tr').filter({ hasText: roleName });
  await expect(roleRow).toBeVisible({ timeout: 10_000 });
  await roleRow.getByRole('button', { name: 'More role' }).click();

  await page.getByRole('menuitem', { name: 'Delete Role' }).click();
  await expect(roleRow).not.toBeVisible({ timeout: 10_000 });

  expect(getCustomRoleByName(org.id, roleName)).toBeFalsy();
});
