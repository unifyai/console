/**
 * Org group calls: DM Meet stage, team ring chrome, and Orchestra session rows.
 *
 * Run: npx playwright test src/tests/assistants/org-call-group.e2e.ts
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
  addAssistantToTeam,
} from '../helpers/seeds/client';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail } from '../helpers/shell';
import { openUnitySwitcher } from './helpers';

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

const assistantOne = createAssistant({
  userId: owner.id,
  firstName: 'Call',
  surname: 'Alpha',
  orgId: org.id,
});
const assistantTwo = createAssistant({
  userId: owner.id,
  firstName: 'Call',
  surname: 'Beta',
  orgId: org.id,
});
addAssistantToTeam(assistantOne, {
  teamId,
  name: teamName,
  description: 'Org call e2e team',
  organizationId: org.id,
});
addAssistantToTeam(assistantTwo, {
  teamId,
  name: teamName,
  description: 'Org call e2e team',
  organizationId: org.id,
});

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

/**
 * The team header only folds its nest; the team conversation is the "Team chat"
 * row inside it.
 */
async function openTeamWorkspace(page: Page) {
  const teamRow = page.getByTestId(`team-list-item-${teamId}`);
  await expect(teamRow).toBeVisible({ timeout: 30_000 });
  if ((await teamRow.getAttribute('aria-expanded')) === 'false') {
    await teamRow.click();
  }
  await page.getByTestId(`team-chat-list-item-${teamId}`).click();
  await expect(page.getByTestId('team-workspace')).toBeVisible({ timeout: 15_000 });
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
    // The roster list lives inside the rail switcher page, so every test
    // here needs it open before it can reach a human, team, or team chat row.
    await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React
    await use(page);
    await ctx.close();
  },
});

test.afterAll(async () => {
  await cleanupUser(owner.id);
  await cleanupUser(member.id);
});

test('DM call opens Meet stage and persists call_session', async ({ ownerPage: page }) => {
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
    `SELECT count(*) FROM call_session WHERE organization_id = ${org.id} AND scope = 'dm'`
  );
  expect(parseInt(count.trim().split('\n').pop() || '0', 10)).toBeGreaterThanOrEqual(1);

  await page.getByTestId('org-call-end').click();
  await expect(page.getByTestId('org-call-meet-stage')).toBeHidden({ timeout: 10_000 });
});

test('team call button starts a team call_session', async ({ ownerPage: page }) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  await openTeamWorkspace(page);

  const callBtn = page.getByTestId('org-chat-call-button');
  await expect(callBtn).toBeVisible();
  await callBtn.click();

  await expect(page.getByTestId('org-call-meet-stage')).toBeVisible({ timeout: 20_000 });

  const row = dbExec(
    `SELECT scope, team_id, status FROM call_session
     WHERE organization_id = ${org.id} AND scope = 'team' AND team_id = ${teamId}
     ORDER BY created_at DESC LIMIT 1`
  );
  expect(row).toContain('team');
  expect(row).toContain(String(teamId));

  await page.getByTestId('org-call-leave').click();
});

test('team call can add two assistants and persists Contacts attribution keys', async ({
  ownerPage: page,
}) => {
  test.setTimeout(120_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  await openTeamWorkspace(page);

  await page.getByTestId('org-chat-call-button').click();
  await expect(page.getByTestId('org-call-meet-stage')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('org-call-add-assistant').click();
  await expect(page.getByTestId('org-call-add-assistant-picker')).toBeVisible();
  await page
    .getByTestId('org-call-add-assistant-picker')
    .getByRole('button', { name: /Call Alpha/i })
    .click();

  await page.getByTestId('org-call-add-assistant').click();
  await expect(page.getByTestId('org-call-add-assistant-picker')).toBeVisible();
  await page
    .getByTestId('org-call-add-assistant-picker')
    .getByRole('button', { name: /Call Beta/i })
    .click();

  await expect
    .poll(
      () => {
        const row = dbExec(
          `SELECT assistant_ids::text FROM call_session
           WHERE organization_id = ${org.id} AND scope = 'team' AND team_id = ${teamId}
           ORDER BY created_at DESC LIMIT 1`
        );
        return row;
      },
      { timeout: 20_000 }
    )
    .toMatch(new RegExp(String(assistantOne.agentId)));

  const assistantIdsRow = dbExec(
    `SELECT assistant_ids::text FROM call_session
     WHERE organization_id = ${org.id} AND scope = 'team' AND team_id = ${teamId}
     ORDER BY created_at DESC LIMIT 1`
  );
  expect(assistantIdsRow).toContain(String(assistantOne.agentId));
  expect(assistantIdsRow).toContain(String(assistantTwo.agentId));

  // Contacts rows for humans (org_user_id) and peer assistants (peer_assistant_id).
  const humanContacts = dbExec(
    `SELECT count(*) FROM log_event
     WHERE data->>'org_user_id' IN ('${owner.id}', '${member.id}')`
  );
  expect(parseInt(humanContacts.trim().split('\n').pop() || '0', 10)).toBeGreaterThanOrEqual(1);

  const peerContacts = dbExec(
    `SELECT count(*) FROM log_event
     WHERE data->>'peer_assistant_id' IN ('${assistantOne.agentId}', '${assistantTwo.agentId}')`
  );
  expect(parseInt(peerContacts.trim().split('\n').pop() || '0', 10)).toBeGreaterThanOrEqual(1);

  // Simulate a spoken turn attribution check via UniSDK-shaped Transcripts insert
  // is out of scope for browser E2E; Orchestra Contacts + assistant_ids cover the
  // Console/Orchestra half. Unify log_message N-receiver coverage is unit-tested.

  await page.getByTestId('org-call-leave').click();
});
