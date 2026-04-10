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
} from './helpers';

const owner = createTestUser({ name: 'RoleOwner', lastName: 'Test', credits: 5_000 });
const org = createOrg({ name: `RoleOrg${Date.now()}`, ownerId: owner.id });

const test = createAccountTest(owner);
test.setTimeout(90_000);

test.afterAll(() => {
  deleteOrg(org.id);
  cleanupUser(owner.id);
});

test('creating a custom role via UI persists it in the database', async ({ authedPage: page }) => {
  const roleName = `CustomRole${Date.now()}`;

  await page.goto('/organizations?tab=roles');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('role-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open create role dialog
  await page.getByRole('button', { name: 'Create new role' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Fill role name
  await dialog.getByPlaceholder('Role Name').fill(roleName);

  // Check the first permission checkbox if available (Radix uses role="checkbox")
  const firstCheckbox = dialog.getByRole('checkbox').first();
  if (await firstCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstCheckbox.click();
  }

  // Submit
  await dialog.getByRole('button', { name: 'Create' }).click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Verify DB
  const roleId = getCustomRoleByName(org.id, roleName);
  expect(roleId).toBeTruthy();

  // Verify role appears in the list
  await expect(page.locator(`text=${roleName}`)).toBeVisible({ timeout: 10_000 });
});

test('managing permissions on a custom role via UI persists changes', async ({
  authedPage: page,
}) => {
  // Seed a custom role with no permissions (setup)
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

  await page.goto('/organizations?tab=roles');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('role-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open row menu for the role
  const roleRow = page.locator('tr').filter({ hasText: roleName });
  await expect(roleRow).toBeVisible({ timeout: 10_000 });
  await roleRow.getByRole('button', { name: 'More role' }).click();

  // Click "Manage Permissions"
  await page.getByRole('menuitem', { name: 'Manage Permissions' }).click();

  // Dialog opens with a permission select and an "Add" button
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Select a permission from the dropdown
  const selectTrigger = dialog.locator('[role="combobox"]');
  await expect(selectTrigger).toBeVisible({ timeout: 5_000 });
  await selectTrigger.click();

  const firstOption = page.getByRole('option').first();
  await expect(firstOption).toBeVisible({ timeout: 5_000 });
  await firstOption.click();

  // Click "Add"
  await dialog.getByRole('button', { name: 'Add' }).click();

  // Wait for the API call to complete
  await page.waitForTimeout(2_000);

  // Verify DB — permission count should have increased
  const permCountAfter = parseInt(
    dbExec(`SELECT count(*) FROM role_permission WHERE role_id = ${roleId}`),
    10
  );
  expect(permCountAfter).toBeGreaterThan(permCountBefore);
});

test('deleting a custom role via UI removes it from the database', async ({ authedPage: page }) => {
  // Seed a custom role (setup)
  const roleName = `DelRole${Date.now()}`;
  dbExec(
    `INSERT INTO role (name, description, organization_id, is_system_role) ` +
      `VALUES ('${roleName}', 'test', ${org.id}, false)`
  );
  expect(getCustomRoleByName(org.id, roleName)).toBeTruthy();

  await page.goto('/organizations?tab=roles');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('role-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open row menu for the role
  const roleRow = page.locator('tr').filter({ hasText: roleName });
  await expect(roleRow).toBeVisible({ timeout: 10_000 });
  await roleRow.getByRole('button', { name: 'More role' }).click();

  // Click "Delete Role" (no confirmation dialog — immediate action)
  await page.getByRole('menuitem', { name: 'Delete Role' }).click();

  // Wait for role to disappear from the list
  await expect(roleRow).not.toBeVisible({ timeout: 10_000 });

  // Verify DB
  expect(getCustomRoleByName(org.id, roleName)).toBeFalsy();
});
