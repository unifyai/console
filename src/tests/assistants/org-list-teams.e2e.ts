/**
 * Org unity switcher: managed Org team is elevated under T-W1N; TEAMS only
 * appears when custom teams exist. GROUPS stays visible even when empty. The
 * header's filter menu persists per browser, and says so while it is cutting
 * the roster.
 *
 * Run: npx playwright test src/tests/assistants/org-list-teams.e2e.ts
 */
import { test as base, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  createOrg,
  addMember,
  ensureProjectSync,
  dbExec,
  createAssistant,
} from '../helpers/seeds/client';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  deferCoordinatorOnboarding,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import {
  assistantRail,
  openAssistantCreateMenu,
  openAssistantFilterMenu,
  railUnitySwitcher,
} from '../helpers/shell';
import { openUnitySwitcher } from './helpers';

const owner = createTestUser({ name: 'OrgList', lastName: 'Owner', credits: 50_000 });
const member = createTestUser({ name: 'OrgList', lastName: 'Member', credits: 50_000 });
const org = createOrg({
  name: `OrgListOrg_${Date.now()}`,
  ownerId: owner.id,
  dataSharingMode: 'shared',
});
addMember({ orgId: org.id, userId: member.id, role: 'Member' });
ensureProjectSync(org.ownerOrgApiKey);

// Orchestra provisions the owner's workspace Coordinator with every org it
// creates (`_create_organization_with_owner_coordinator`); the org list pins it
// above the elevated Org team. The raw-SQL org seed bypasses that path, so the
// twin is seeded explicitly.
const orgCoordinator = createAssistant({
  userId: owner.id,
  firstName: 'T-W1N',
  surname: null,
  orgId: org.id,
  isCoordinator: true,
});

createAssistant({
  userId: owner.id,
  firstName: 'List',
  surname: 'Unity',
  orgId: org.id,
});

const orgTeamId = Number(
  dbExec(
    `SELECT id FROM team
     WHERE organization_id = ${org.id} AND is_org_wide_sharing = true
     ORDER BY id LIMIT 1;`
  )
    .trim()
    .split('\n')
    .pop()
);

async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-org-list-teams-${email.replace(/[^a-z0-9]/gi, '-')}.json`
  );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 45_000);
  await deferCoordinatorForUser(owner.id, owner.apiKey);

  await completeAccountOnboardingIfPresent(page);

  await page.request.post('/api/session/workspace', {
    data: { workspaceId: String(orgId) },
  });
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
      window.localStorage.setItem('referral-banner-dismissed', '1');
      document.cookie = 'console_dev_calls=1; path=/';
    } catch {
      /* ignore */
    }
  });
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await deferCoordinatorAfterAssistantsLoad(page, owner.id, owner.apiKey);
  await dismissCoordinatorOnboardingIfOpen(page);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

let ownerAuthFile: string | undefined;

const test = base.extend<{ ownerPage: Page }>({
  ownerPage: async ({ browser }, use, testInfo) => {
    if (!ownerAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      ownerAuthFile = await loginAndSaveOrgState(browser, owner.email, owner.password, org.id);
    }
    const ctx = await browser.newContext({ storageState: ownerAuthFile });
    const page = await ctx.newPage();
    await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
    await dismissCoordinatorOnboardingIfOpen(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React
    await use(page);
    await ctx.close();
  },
});

// A freshly provisioned Coordinator resolves with `onboarding_active: true`,
// rendering the full-screen overlay that swallows pointer events. This suite
// drives the regular rail switcher, so pause it before the first page load.
test.beforeAll(async () => {
  await deferCoordinatorOnboarding(org.ownerOrgApiKey, orgCoordinator.agentId);
});

test.afterAll(async () => {
  await cleanupUser(owner.id);
  await cleanupUser(member.id);
});

test('managed Org team sits under T-W1N; TEAMS hides until a custom team exists @area(assistants.core)', async ({
  ownerPage: page,
}) => {
  test.setTimeout(90_000);
  expect(Number.isFinite(orgTeamId)).toBe(true);

  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  const elevated = page.getByTestId('assistant-list-elevated-org-team');
  await expect(elevated).toBeVisible({ timeout: 15_000 });
  await expect(elevated.getByTestId(`team-list-item-${orgTeamId}`)).toBeVisible();
  await expect(elevated.getByTestId(`team-list-item-${orgTeamId}`)).toContainText(org.name);
  await expect(page.getByTestId('assistant-list-group-pinned')).toBeVisible();

  // No custom teams / groups yet — TEAMS and GROUPS nests stay hidden.
  // Every creation action lives in the header's "+" menu, above the roster.
  await expect(page.getByTestId('assistant-list-section-teams')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-groups')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-people')).toHaveCount(0);
  const orgTeamGroup = page.getByTestId(`assistant-list-group-team:${orgTeamId}`);
  const orgTeamRow = orgTeamGroup.getByTestId(`team-list-item-${orgTeamId}`);
  const createMenu = page.getByTestId('assistant-create-menu');
  await expect(createMenu).toBeVisible();
  await openAssistantCreateMenu(page);
  await expect(page.getByTestId('create-group-button')).toBeVisible();
  await expect(page.getByTestId('create-team-button')).toBeVisible();
  await expect(page.getByTestId('assistant-onboard-button')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('create-group-button')).toHaveCount(0);

  // Folding the Org team nest cannot swallow the creation actions.
  if ((await orgTeamRow.getAttribute('aria-expanded')) === 'false') {
    await orgTeamRow.click();
  }
  await orgTeamRow.click();
  await expect(createMenu).toBeVisible();
  await orgTeamRow.click();
  await expect(createMenu).toBeVisible();

  const customTeamName = `CustomTeam_${Date.now()}`;
  const rawCustomTeamId = dbExec(`
INSERT INTO team (name, description, organization_id, status)
VALUES ('${customTeamName}', 'Custom team for list elevation e2e', ${org.id}, 'active')
RETURNING id;
`);
  const customTeamId = Number(rawCustomTeamId.match(/^\d+$/m)?.[0]);
  dbExec(`
INSERT INTO team_member (team_id, user_id)
VALUES (${customTeamId}, '${owner.id}')
ON CONFLICT (team_id, user_id) DO NOTHING;
`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCoordinatorOnboardingIfOpen(page);
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  await expect(page.getByTestId('assistant-list-elevated-org-team')).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByTestId('assistant-list-elevated-org-team').getByTestId(`team-list-item-${orgTeamId}`)
  ).toBeVisible();

  const teamsSection = page.getByTestId('assistant-list-section-teams');
  await expect(teamsSection).toBeVisible({ timeout: 15_000 });
  await expect(teamsSection.getByTestId(`team-list-item-${customTeamId}`)).toBeVisible();
  await expect(teamsSection.getByTestId(`team-list-item-${orgTeamId}`)).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-groups')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-people')).toHaveCount(0);
  await expect(page.getByTestId('assistant-create-menu')).toBeVisible();

  await openAssistantCreateMenu(page);
  await page.getByTestId('create-team-button').click();
  await expect(page).toHaveURL(/\/organizations\?tab=teams/, { timeout: 15_000 });
});

test('create group and onboard dismissals return to the unity switcher', async ({
  ownerPage: page,
}) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  await expect(page.getByTestId('assistant-create-menu')).toBeVisible({ timeout: 15_000 });

  const switcherPopover = page.getByTestId('rail-unity-switcher-popover');

  await openAssistantCreateMenu(page);
  await expect(switcherPopover).toBeVisible();
  await page.getByTestId('create-group-button').click();
  await expect(page.getByTestId('create-group-dialog')).toBeVisible({ timeout: 5_000 });
  await expect(switcherPopover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('create-group-dialog')).toHaveCount(0, { timeout: 5_000 });
  await expect(switcherPopover).toBeVisible();

  await openAssistantCreateMenu(page);
  await page.getByTestId('assistant-onboard-button').click();
  await expect(page.getByRole('heading', { name: 'Onboard Teammate' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(switcherPopover).toBeVisible();
  await page.getByRole('button', { name: 'Close onboard dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Onboard Teammate' })).toHaveCount(0, {
    timeout: 5_000,
  });
  await expect(switcherPopover).toBeVisible();

  // The contrast those two exceptions are exceptions to: picking a teammate is
  // the errand itself, so the list dismisses rather than lingering over it.
  const orgTeamRow = page
    .getByTestId(`assistant-list-group-team:${orgTeamId}`)
    .getByTestId(`team-list-item-${orgTeamId}`);
  if ((await orgTeamRow.getAttribute('aria-expanded')) === 'false') {
    await orgTeamRow.click();
  }
  await page.getByTestId(`human-list-item-${member.id}`).click();
  await expect(switcherPopover).toHaveCount(0, { timeout: 5_000 });
});

test('list filters survive the menu, the popover and a reload until Show all clears them', async ({
  ownerPage: page,
}) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  const elevated = page.getByTestId('assistant-list-elevated-org-team');
  const filterTrigger = page.getByTestId('assistant-list-filter-menu');
  await expect(elevated).toBeVisible({ timeout: 15_000 });
  await expect(filterTrigger).not.toHaveAttribute('data-filtered', 'true');

  // Unchecking Teams takes the elevated managed team with it.
  await openAssistantFilterMenu(page);
  await page.getByTestId('assistant-list-filter-teams').click();
  await expect(elevated).toHaveCount(0, { timeout: 5_000 });
  await expect(filterTrigger).toHaveAttribute('data-filtered', 'true');
  expect(
    await page.evaluate(() => window.localStorage.getItem('console:assistants:listFilters'))
  ).toBe(JSON.stringify({ v: 1, hidden: ['teams'] }));

  // The preference outlives the popover it was set in, and the page too.
  // Escape only dismisses the menu here, so the switcher face does the closing.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0, { timeout: 5_000 });
  await railUnitySwitcher(page).click();
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });
  await expect(elevated).toHaveCount(0);
  await expect(filterTrigger).toHaveAttribute('data-filtered', 'true');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCoordinatorOnboardingIfOpen(page);
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });
  await expect(filterTrigger).toHaveAttribute('data-filtered', 'true');
  await expect(elevated).toHaveCount(0);
  await openAssistantFilterMenu(page);
  await expect(page.getByTestId('assistant-list-filter-teams')).toHaveAttribute(
    'aria-checked',
    'false'
  );

  // Show all is the way back out, and that clearing persists as well.
  await page.getByTestId('assistant-list-filter-show-all').click();
  await expect(elevated).toBeVisible({ timeout: 10_000 });
  await expect(filterTrigger).not.toHaveAttribute('data-filtered', 'true');
  await expect(page.getByTestId('assistant-list-filter-show-all')).toHaveCount(0);
  expect(
    await page.evaluate(() => window.localStorage.getItem('console:assistants:listFilters'))
  ).toBe(JSON.stringify({ v: 1, hidden: [] }));

  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCoordinatorOnboardingIfOpen(page);
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });
  await expect(elevated).toBeVisible({ timeout: 15_000 });
});
