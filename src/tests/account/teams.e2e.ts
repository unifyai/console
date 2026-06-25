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
  createAssistant,
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

const sharingOwner = createTestUser({ name: 'SharingOwner', lastName: 'Test', credits: 5_000 });
const sharingMember = createTestUser({ name: 'SharingMember', lastName: 'Test', credits: 5_000 });
const sharingOrg = createOrg({ name: `SharingOrg${Date.now()}`, ownerId: sharingOwner.id });
addMember({ orgId: sharingOrg.id, userId: sharingMember.id, role: 'Member' });
const sharingAssistant = createAssistant({
  userId: sharingOwner.id,
  orgId: sharingOrg.id,
  firstName: 'Sharing',
  surname: 'Unity',
});

const sharingTest = createAccountTest(sharingOwner);
sharingTest.setTimeout(90_000);

const creationUser = createTestUser({ name: 'CreateOrgSharing', lastName: 'Test', credits: 5_000 });
const creationTest = createAccountTest(creationUser);
creationTest.setTimeout(90_000);
let createdDialogOrgId: number | null = null;

test.afterAll(() => {
  deleteOrg(org.id);
  cleanupUser(owner.id);
  cleanupUser(member.id);
});

sharingTest.afterAll(() => {
  deleteOrg(sharingOrg.id);
  cleanupUser(sharingOwner.id);
  cleanupUser(sharingMember.id);
});

creationTest.afterAll(() => {
  if (createdDialogOrgId) deleteOrg(createdDialogOrgId);
  cleanupUser(creationUser.id);
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
  await expect.poll(() => getTeamByName(org.id, teamName) ?? '', { timeout: 15_000 }).not.toBe('');
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
  await expect
    .poll(() => getTeamMemberCount(teamId), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
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

sharingTest(
  'org-wide sharing toggle manages the Org team lifecycle',
  async ({ authedPage: page }) => {
    await page.goto('/organizations?tab=teams');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.getByTestId('team-list-panel')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('org-sharing-toggle').click();

    await expect(page.getByTestId('org-sharing-enabled-copy')).toBeVisible({ timeout: 15_000 });
    const orgTeamRow = page.locator('tr').filter({ hasText: 'Org' });
    await expect(orgTeamRow).toBeVisible({ timeout: 10_000 });
    await expect(orgTeamRow).toContainText('Managed');
    await expect(orgTeamRow.getByRole('button', { name: 'More team' })).toHaveCount(0);

    const sharingEnabled = dbExec(
      `SELECT org_wide_sharing_enabled FROM organization WHERE id = ${sharingOrg.id}`
    );
    expect(sharingEnabled).toBe('t');

    const orgTeamId = getTeamByName(sharingOrg.id, 'Org');
    expect(orgTeamId).toBeTruthy();

    expect(getTeamMemberCount(orgTeamId!)).toBe(2);

    const assistantMembershipCount = dbExec(
      `SELECT count(*) FROM team_assistant_memberships WHERE team_id = ${orgTeamId} AND assistant_id = ${sharingAssistant.agentId}`
    );
    expect(assistantMembershipCount).toBe('1');

    await page.getByTestId('org-sharing-toggle').click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('confirm-disable-org-sharing').click();

    await expect(orgTeamRow).not.toBeVisible({ timeout: 15_000 });

    const sharingDisabled = dbExec(
      `SELECT org_wide_sharing_enabled FROM organization WHERE id = ${sharingOrg.id}`
    );
    expect(sharingDisabled).toBe('f');
    expect(getTeamByName(sharingOrg.id, 'Org')).toBeFalsy();

    const remainingAssistantMembershipCount = dbExec(
      `SELECT count(*) FROM team_assistant_memberships WHERE assistant_id = ${sharingAssistant.agentId}`
    );
    expect(remainingAssistantMembershipCount).toBe('0');
  }
);

creationTest(
  'creating an organization from Organizations page supports shared mode',
  async ({ authedPage: page }) => {
    const orgName = `DialogSharedOrg${Date.now()}`;

    await page.goto('/organizations');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.getByRole('button', { name: 'Create organization' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByTestId('create-org-name-input').fill(orgName);
    await expect(dialog.getByTestId('create-org-name-input')).toHaveValue(orgName);
    await dialog.getByTestId('create-org-sharing-shared').click();
    await expect(dialog.getByRole('radio', { name: /Shared/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect
      .poll(() => dbExec(`SELECT id FROM organization WHERE name = '${orgName}'`), {
        timeout: 15_000,
      })
      .not.toBe('');
    const orgId = dbExec(`SELECT id FROM organization WHERE name = '${orgName}'`);
    expect(orgId).toBeTruthy();
    createdDialogOrgId = parseInt(orgId, 10);

    await expect
      .poll(
        () =>
          dbExec(
            `SELECT org_wide_sharing_enabled FROM organization WHERE id = ${createdDialogOrgId}`
          ),
        { timeout: 15_000 }
      )
      .toBe('t');

    await expect
      .poll(() => getTeamByName(createdDialogOrgId!, 'Org') ?? '', { timeout: 15_000 })
      .not.toBe('');
    const orgTeamId = getTeamByName(createdDialogOrgId, 'Org');
    expect(orgTeamId).toBeTruthy();
    expect(getTeamMemberCount(orgTeamId!)).toBe(1);
  }
);
