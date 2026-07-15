/**
 * Org group calls: DM Meet stage, team ring chrome, and Orchestra session rows.
 *
 * Run: npx playwright test src/tests/assistants/org-call-group.e2e.ts
 */
import { test as base, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';
import { createOrg, addMember, ensureProjectSync, dbExec } from '../helpers/seeds/client';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail } from '../helpers/shell';

const owner = createTestUser({ name: 'OrgCall', lastName: 'Owner', credits: 50_000 });
const member = createTestUser({ name: 'OrgCall', lastName: 'Member', credits: 50_000 });
const org = createOrg({ name: `OrgCallOrg_${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });
ensureProjectSync(org.ownerOrgApiKey);

const teamName = `CallTeam_${Date.now()}`;
const rawTeamId = dbExec(`
INSERT INTO team (name, description, organization_id, status)
VALUES ('${teamName}', 'Org call e2e team', ${org.id}, 'active')
RETURNING id;
`);
const teamId = Number(rawTeamId.match(/^\d+$/m)?.[0]);
dbExec(`
INSERT INTO team_member (team_id, user_id)
VALUES (${teamId}, '${owner.id}'), (${teamId}, '${member.id}')
ON CONFLICT (team_id, user_id) DO NOTHING;
`);

async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-org-call-group-${email.replace(/[^a-z0-9]/gi, '-')}.json`
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
    await ctx.addCookies([
      {
        name: 'console_dev_calls',
        value: '1',
        domain: 'localhost',
        path: '/',
      },
    ]);
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

test('DM call opens Meet stage and persists org_call_session', async ({ ownerPage: page }) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  const humanRow = page.getByTestId(`human-list-item-${member.id}`);
  await expect(humanRow).toBeVisible({ timeout: 30_000 });
  await humanRow.click();

  await expect(page.getByTestId('human-workspace')).toBeVisible({ timeout: 15_000 });
  const callBtn = page.getByTestId('org-chat-call-button');
  await expect(callBtn).toBeVisible();
  await callBtn.click();

  await expect(page.getByTestId('org-call-meet-stage')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('org-call-meet-grid')).toBeVisible();

  const count = dbExec(
    `SELECT count(*) FROM org_call_session WHERE organization_id = ${org.id} AND scope = 'dm'`
  );
  expect(parseInt(count.trim().split('\n').pop() || '0', 10)).toBeGreaterThanOrEqual(1);

  await page.getByTestId('org-call-end').click();
  await expect(page.getByTestId('org-call-meet-stage')).toBeHidden({ timeout: 10_000 });
});

test('team call button starts a team org_call_session', async ({ ownerPage: page }) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  const teamRow = page.getByTestId(`team-list-item-${teamId}`);
  await expect(teamRow).toBeVisible({ timeout: 30_000 });
  await teamRow.click();

  await expect(page.getByTestId('team-workspace')).toBeVisible({ timeout: 15_000 });
  const callBtn = page.getByTestId('org-chat-call-button');
  await expect(callBtn).toBeVisible();
  await callBtn.click();

  await expect(page.getByTestId('org-call-meet-stage')).toBeVisible({ timeout: 20_000 });

  const row = dbExec(
    `SELECT scope, team_id, status FROM org_call_session
     WHERE organization_id = ${org.id} AND scope = 'team' AND team_id = ${teamId}
     ORDER BY created_at DESC LIMIT 1`
  );
  expect(row).toContain('team');
  expect(row).toContain(String(teamId));

  await page.getByTestId('org-call-leave').click();
});
