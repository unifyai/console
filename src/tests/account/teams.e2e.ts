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
  navigateToAppShellRoute,
  switchWorkspaceViaApi,
} from './helpers';
import { deferCoordinatorOnboarding, getCoordinatorAgentId } from '../helpers/coordinator';

const owner = createTestUser({ name: 'TeamOwner', lastName: 'Test', credits: 5_000 });
const member = createTestUser({ name: 'TeamMember', lastName: 'Test', credits: 5_000 });
const org = createOrg({ name: `TeamOrg${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });

const test = createAccountTest(owner);
test.setTimeout(90_000);

const ownerShellOpts = { userId: owner.id, apiKey: owner.apiKey };

async function openOrgTeamsTab(page: import('@playwright/test').Page) {
  await switchWorkspaceViaApi(page, org.id, ownerShellOpts);
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find((c) => c.name === 'unify_workspace_id')?.value ?? '';
    })
    .toBe(String(org.id));
  await navigateToAppShellRoute(page, '/organizations?tab=teams', ownerShellOpts);
  await expect(page.getByTestId('team-list-panel')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Create new team' })).toBeVisible({
    timeout: 15_000,
  });
}

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

const sharingShellOpts = { userId: sharingOwner.id, apiKey: sharingOwner.apiKey };

const creationUser = createTestUser({ name: 'CreateOrgSharing', lastName: 'Test', credits: 5_000 });
const creationTest = createAccountTest(creationUser);
creationTest.setTimeout(90_000);
const creationShellOpts = { userId: creationUser.id, apiKey: creationUser.apiKey };
let createdDialogOrgId: number | null = null;

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(owner.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(owner.apiKey, coordinatorId);
  }
});

sharingTest.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(sharingOwner.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(sharingOwner.apiKey, coordinatorId);
  }
});

creationTest.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(creationUser.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(creationUser.apiKey, coordinatorId);
  }
});

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

test('team lifecycle via UI creates, adds a member, removes a member, and deletes @critical @area(workspace)', async ({
  authedPage: page,
}) => {
  const teamName = `Team${Date.now()}`;

  await openOrgTeamsTab(page);
  await page.getByRole('button', { name: 'Create new team' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByPlaceholder('Team Name').fill(teamName);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await expect.poll(() => getTeamByName(org.id, teamName) ?? '', { timeout: 15_000 }).not.toBe('');
  const teamId = getTeamByName(org.id, teamName)!;
  expect(teamId).toBeTruthy();
  await expect(page.locator(`text=${teamName}`)).toBeVisible({ timeout: 10_000 });
  expect(getTeamMemberCount(teamId)).toBe(0);

  let teamRow = page.locator('tr').filter({ hasText: teamName });
  await teamRow.getByRole('button', { name: 'More team' }).click();
  await page.getByRole('menuitem', { name: 'Add member' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.locator('[role="combobox"]').click();
  await page.getByRole('option').first().click();
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => getTeamMemberCount(teamId), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);

  teamRow = page.locator('tr').filter({ hasText: teamName });
  await teamRow.getByRole('button', { name: 'More team' }).click();
  await page.getByRole('menuitem', { name: 'Remove member' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.locator('[role="combobox"]').click();
  await page.getByRole('option').first().click();
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  expect(getTeamMemberCount(teamId)).toBe(0);

  teamRow = page.locator('tr').filter({ hasText: teamName });
  await teamRow.getByRole('button', { name: 'More team' }).click();
  await page.getByRole('menuitem', { name: 'Delete team' }).click();
  await expect(teamRow).not.toBeVisible({ timeout: 10_000 });
  expect(getTeamByName(org.id, teamName)).toBeFalsy();
});

sharingTest(
  'org-wide sharing toggle manages the Org team lifecycle',
  async ({ authedPage: page }) => {
    await switchWorkspaceViaApi(page, sharingOrg.id, sharingShellOpts);
    await navigateToAppShellRoute(page, '/organizations?tab=teams', sharingShellOpts);
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

    await navigateToAppShellRoute(page, '/organizations', creationShellOpts);
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
