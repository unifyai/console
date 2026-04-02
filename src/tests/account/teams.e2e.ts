/**
 * Team Management E2E — create team, add/remove member, delete team.
 *
 * All mutations go through the actual UI (page actions). DB is used
 * only for seeding prerequisite state and verifying outcomes.
 *
 * Run: npx playwright test src/tests/account/teams.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  createOrg,
  addMember,
  deleteOrg,
  dbExec,
  getTeamByName,
  getTeamMemberCount,
} from './helpers';

const owner = createTestUser({ name: 'TeamOwner', lastName: 'Test', credits: 5_000 });
const member = createTestUser({ name: 'TeamMember', lastName: 'Test', credits: 5_000 });
const org = createOrg({ name: `TeamOrg${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });

const test = createAccountTest(owner);
test.setTimeout(90_000);

test.afterAll(() => {
  deleteOrg(org.id);
  cleanupUser(owner.id);
  cleanupUser(member.id);
});

test('creating a team via UI adds it to the database', async ({ authedPage: page }) => {
  const teamName = `Team${Date.now()}`;

  await page.goto('/organizations?tab=teams');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('team-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open create team dialog
  await page.getByRole('button', { name: 'Create new team' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Fill team name
  await dialog.getByPlaceholder('Team Name').fill(teamName);

  // Submit
  await dialog.getByRole('button', { name: 'Create' }).click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Verify team exists in DB
  const teamId = getTeamByName(org.id, teamName);
  expect(teamId).toBeTruthy();

  // Verify team appears in the list
  await expect(page.locator(`text=${teamName}`)).toBeVisible({ timeout: 10_000 });
});

test('adding a member to a team via UI creates a team_member record', async ({
  authedPage: page,
}) => {
  // Seed a team (setup, not action under test)
  const teamName = `AddMbrTeam${Date.now()}`;
  dbExec(
    `INSERT INTO team (name, description, organization_id) VALUES ('${teamName}', 'test', ${org.id})`
  );
  const teamId = getTeamByName(org.id, teamName)!;
  expect(getTeamMemberCount(teamId)).toBe(0);

  await page.goto('/organizations?tab=teams');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('team-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open row menu for the team
  const teamRow = page.locator('tr').filter({ hasText: teamName });
  await expect(teamRow).toBeVisible({ timeout: 10_000 });
  await teamRow.getByRole('button', { name: 'More team' }).click();

  // Click "Add member"
  await page.getByRole('menuitem', { name: 'Add member' }).click();

  // Dialog opens with a member select
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Select a member from the dropdown
  await dialog.locator('[role="combobox"]').click();
  await page.getByRole('option').first().click();

  // Submit
  await dialog.getByRole('button', { name: 'Add' }).click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Verify DB
  expect(getTeamMemberCount(teamId)).toBeGreaterThanOrEqual(1);
});

test('removing a member from a team via UI removes the team_member record', async ({
  authedPage: page,
}) => {
  // Seed a team with a member (setup)
  const teamName = `RmMbrTeam${Date.now()}`;
  dbExec(
    `INSERT INTO team (name, description, organization_id) VALUES ('${teamName}', 'test', ${org.id})`
  );
  const teamId = getTeamByName(org.id, teamName)!;
  dbExec(
    `INSERT INTO team_member (team_id, user_id) VALUES (${teamId}, '${member.id}') ON CONFLICT DO NOTHING`
  );
  expect(getTeamMemberCount(teamId)).toBe(1);

  await page.goto('/organizations?tab=teams');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('team-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open row menu for the team
  const teamRow = page.locator('tr').filter({ hasText: teamName });
  await expect(teamRow).toBeVisible({ timeout: 10_000 });
  await teamRow.getByRole('button', { name: 'More team' }).click();

  // Click "Remove member"
  await page.getByRole('menuitem', { name: 'Remove member' }).click();

  // Dialog opens with a member-to-remove select
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Select the member to remove
  await dialog.locator('[role="combobox"]').click();
  await page.getByRole('option').first().click();

  // Submit
  await dialog.getByRole('button', { name: 'Remove' }).click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Verify DB
  expect(getTeamMemberCount(teamId)).toBe(0);
});

test('deleting a team via UI removes it from the database', async ({ authedPage: page }) => {
  // Seed a team (setup)
  const teamName = `DelTeam${Date.now()}`;
  dbExec(
    `INSERT INTO team (name, description, organization_id) VALUES ('${teamName}', 'test', ${org.id})`
  );
  expect(getTeamByName(org.id, teamName)).toBeTruthy();

  await page.goto('/organizations?tab=teams');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await expect(page.getByTestId('team-list-panel')).toBeVisible({ timeout: 15_000 });

  // Open row menu for the team
  const teamRow = page.locator('tr').filter({ hasText: teamName });
  await expect(teamRow).toBeVisible({ timeout: 10_000 });
  await teamRow.getByRole('button', { name: 'More team' }).click();

  // Click "Delete team" (no confirmation dialog — immediate action)
  await page.getByRole('menuitem', { name: 'Delete team' }).click();

  // Wait for team to disappear from the list
  await expect(teamRow).not.toBeVisible({ timeout: 10_000 });

  // Verify DB
  expect(getTeamByName(org.id, teamName)).toBeFalsy();
});
