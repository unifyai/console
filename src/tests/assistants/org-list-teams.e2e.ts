/**
 * Org unity switcher: managed Org team is elevated under T-W1N; TEAMS only
 * appears when custom teams exist. GROUPS stays visible even when empty.
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
import { loginAndWaitForRedirect } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail } from '../helpers/shell';
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

  if (page.url().includes('/login/onboarding')) {
    await page
      .waitForURL((url) => !url.pathname.includes('onboarding'), { timeout: 20_000 })
      .catch(async () => {
        const personalBtn = page.getByTestId('workspace-personal');
        if (await personalBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await personalBtn.click();
          await page.getByTestId('workspace-continue').click();
          await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
            timeout: 15_000,
          });
        }
      });
  }

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
  // Creation actions live under the elevated Org team instead.
  await expect(page.getByTestId('assistant-list-section-teams')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-groups')).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-section-people')).toHaveCount(0);
  const orgActions = page.getByTestId('assistant-list-org-actions');
  await expect(orgActions).toBeVisible();
  await expect(orgActions.getByTestId('create-group-button')).toBeVisible();
  await expect(orgActions.getByTestId('create-team-button')).toBeVisible();
  await expect(orgActions.getByTestId('assistant-onboard-button')).toBeVisible();

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
  await expect(page.getByTestId('assistant-list-org-actions')).toBeVisible();

  await page.getByTestId('create-team-button').click();
  await expect(page).toHaveURL(/\/organizations\?tab=teams/, { timeout: 15_000 });
});
