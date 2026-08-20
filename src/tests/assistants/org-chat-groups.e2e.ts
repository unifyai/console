/**
 * Org chat Groups: create from rail, Chat-only workspace, message, call.
 *
 * Run: npx playwright test src/tests/assistants/org-chat-groups.e2e.ts
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
  createChatGroup,
} from '../helpers/seeds/client';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import {
  assistantRail,
  openAssistantCreateMenu,
  railSection,
  visibleShellTestId,
} from '../helpers/shell';
import { openUnitySwitcher } from './helpers';

const owner = createTestUser({ name: 'ChatGroup', lastName: 'Owner', credits: 50_000 });
const member = createTestUser({ name: 'ChatGroup', lastName: 'Member', credits: 50_000 });
const org = createOrg({ name: `ChatGroupOrg_${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });
ensureProjectSync(org.ownerOrgApiKey);

const assistantOne = createAssistant({
  userId: owner.id,
  firstName: 'Group',
  surname: 'Alpha',
  orgId: org.id,
});
const assistantTwo = createAssistant({
  userId: owner.id,
  firstName: 'Group',
  surname: 'Beta',
  orgId: org.id,
});

const seededGroup = createChatGroup({
  organizationId: org.id,
  name: `SeededGroup_${Date.now()}`,
  createdByUserId: owner.id,
  userIds: [owner.id, member.id],
  assistantIds: [assistantOne.agentId, assistantTwo.agentId],
});

async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-org-chat-groups-${email.replace(/[^a-z0-9]/gi, '-')}.json`
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

test('seeded group shows Chat-only rail and accepts a message', async ({ ownerPage: page }) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  const groupRow = page.getByTestId(`group-list-item-${seededGroup.groupId}`);
  await expect(groupRow).toBeVisible({ timeout: 30_000 });
  await groupRow.click();

  await expect(page.getByTestId('group-workspace')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('org-chat-panel')).toBeVisible();
  await expect(page.getByTestId('org-chat-call-button')).toBeVisible();

  // Groups are Chat-only — Members / Brain rail sections must not appear.
  // Avoid substring name match on the switcher caption "N members".
  await expect(railSection(page, 'chat')).toBeVisible();
  await expect(railSection(page, 'members')).toHaveCount(0);
  await expect(railSection(page, 'actions')).toHaveCount(0);
  await expect(railSection(page, 'dashboards')).toHaveCount(0);

  const body = `group-e2e-msg-${Date.now()}`;
  const composer = page.getByTestId('org-chat-composer');
  await composer.fill(body);
  const sendBtn = page.getByTestId('org-chat-send');
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();
  await expect(page.getByTestId('org-chat-panel').getByText(body)).toBeVisible({
    timeout: 15_000,
  });
  await expect(composer).toHaveValue('');

  // The panel renders optimistically, so the send is only real once the
  // unified chat store holds the row, attributed to the sender.
  await expect
    .poll(
      () =>
        dbExec(
          `SELECT m.sender_user_id FROM chat_message m
           JOIN chat_thread t ON t.id = m.thread_id
           WHERE t.kind = 'group' AND t.group_id = ${seededGroup.groupId}
             AND m.content = '${body.replace(/'/g, "''")}'`
        ).trim(),
      { timeout: 15_000 }
    )
    .toBe(owner.id);
});

test('create group from rail + opens dialog and persists membership', async ({
  ownerPage: page,
}) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  await openAssistantCreateMenu(page);
  await page.getByTestId('create-group-button').click();
  await expect(page.getByTestId('create-group-dialog')).toBeVisible({ timeout: 5_000 });

  const groupName = `UIGroup_${Date.now()}`;
  await page.getByTestId('create-group-name-input').fill(groupName);
  await page.getByTestId(`create-group-human-${member.id}`).click();
  await page.getByTestId(`create-group-assistant-${assistantOne.agentId}`).click();
  await page.getByTestId('create-group-submit').click();

  await expect(page.getByTestId('create-group-dialog')).toBeHidden({ timeout: 15_000 });

  const row = dbExec(
    `SELECT id, name, status FROM chat_group
     WHERE organization_id = ${org.id} AND name = '${groupName.replace(/'/g, "''")}'
     ORDER BY id DESC LIMIT 1`
  );
  expect(row).toContain(groupName);
  expect(row).toMatch(/active/i);

  const groupIdMatch = row.match(/^\s*(\d+)/m);
  const newGroupId = groupIdMatch ? Number(groupIdMatch[1]) : NaN;
  expect(Number.isInteger(newGroupId)).toBe(true);

  const members = dbExec(
    `SELECT user_id, assistant_id FROM chat_group_member WHERE group_id = ${newGroupId}`
  );
  expect(members).toContain(owner.id);
  expect(members).toContain(member.id);
  expect(members).toContain(String(assistantOne.agentId));

  await expect(page.getByTestId('group-workspace')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('group-workspace').getByText(groupName)).toBeVisible({
    timeout: 10_000,
  });
});

test('group row settings rename the group and set its icon', async ({ ownerPage: page }) => {
  test.setTimeout(120_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  const groupRow = page.getByTestId(`group-list-item-${seededGroup.groupId}`);
  await expect(groupRow).toBeVisible({ timeout: 30_000 });

  const settingsButton = page.getByTestId(`group-row-settings-${seededGroup.groupId}`);
  const panel = page.getByTestId(`group-settings-panel-${seededGroup.groupId}`);

  await groupRow.hover();
  await settingsButton.click();
  await expect(panel).toBeVisible({ timeout: 10_000 });

  const renamed = `RenamedGroup_${Date.now()}`;
  await page.getByTestId(`group-settings-name-${seededGroup.groupId}`).fill(renamed);
  await page.getByTestId(`group-settings-name-save-${seededGroup.groupId}`).click();
  await expect(panel).toBeHidden({ timeout: 15_000 });

  // The switcher survives the settings panel; the renamed row is still there.
  await expect(groupRow).toContainText(renamed, { timeout: 15_000 });
  expect(dbExec(`SELECT name FROM chat_group WHERE id = ${seededGroup.groupId}`)).toContain(
    renamed
  );

  await groupRow.hover();
  await settingsButton.click();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  const emojiSearch = page.locator('.EmojiPickerReact').getByPlaceholder('Search');
  await expect(emojiSearch).toBeVisible({ timeout: 10_000 });
  await emojiSearch.fill('tada');
  await page.locator('.EmojiPickerReact button').filter({ hasText: '🎉' }).first().click();
  await expect(panel).toBeHidden({ timeout: 15_000 });
  await expect(groupRow).toContainText('🎉', { timeout: 15_000 });

  await expect
    .poll(() => dbExec(`SELECT icon FROM chat_group WHERE id = ${seededGroup.groupId}`), {
      timeout: 15_000,
    })
    .toContain('🎉');

  await groupRow.hover();
  await settingsButton.click();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await page.getByTestId(`group-settings-icon-clear-${seededGroup.groupId}`).click();
  await expect(panel).toBeHidden({ timeout: 15_000 });

  await expect
    .poll(
      () =>
        dbExec(
          `SELECT count(*) FROM chat_group WHERE id = ${seededGroup.groupId} AND icon IS NULL`
        ).includes('1'),
      { timeout: 15_000 }
    )
    .toBe(true);
});

test('group call starts call_session with scope=group', async ({ ownerPage: page }) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await openUnitySwitcher(page, { userId: owner.id, apiKey: owner.apiKey });

  const groupRow = page.getByTestId(`group-list-item-${seededGroup.groupId}`);
  await expect(groupRow).toBeVisible({ timeout: 30_000 });
  await groupRow.click();

  await expect(page.getByTestId('group-workspace')).toBeVisible({ timeout: 15_000 });
  const callBtn = page.getByTestId('org-chat-call-button');
  await expect(callBtn).toBeVisible();
  await expect(callBtn).toBeEnabled({ timeout: 10_000 });
  await callBtn.click();

  await expect
    .poll(
      () => {
        const sessionRow = dbExec(
          `SELECT scope, group_id, status FROM call_session
           WHERE organization_id = ${org.id} AND scope = 'group' AND group_id = ${seededGroup.groupId}
           ORDER BY created_at DESC LIMIT 1`
        );
        return sessionRow.includes('group') && sessionRow.includes(String(seededGroup.groupId))
          ? 'ready'
          : 'pending';
      },
      { timeout: 20_000 }
    )
    .toBe('ready');

  const meetStage = page.getByTestId('org-call-meet-stage');
  if (await meetStage.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByTestId('org-call-end').click();
    await expect(meetStage).toBeHidden({ timeout: 10_000 });
  }
});

/** No settings surface carries Groups: no heading, no create control, no nav entry. */
async function expectNoGroupsSurface(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /^Groups$/i })).toHaveCount(0);
  await expect(page.getByTestId('create-group-button')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Groups$/i })).toHaveCount(0);
}

test('Groups are not under Organization settings', async ({ ownerPage: page }) => {
  test.setTimeout(120_000);
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await dismissCoordinatorOnboardingIfOpen(page);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  // Settings is reached through the workspace it belongs to — the rail foot's
  // workspace face — so the entry carries that workspace's name rather than a
  // bare label. The face routes through the shell's client router, so a click
  // landing before that router mounts is dropped silently: click until the
  // route takes. (`networkidle` is no substitute — the shell's SSE traffic
  // never lets it settle.)
  await expect
    .poll(
      async () => {
        if (new URL(page.url()).pathname === '/account') return '/account';
        await visibleShellTestId(page, 'rail-nav-settings').click();
        await page.waitForURL(/\/account/, { timeout: 5_000 }).catch(() => {});
        return new URL(page.url()).pathname;
      },
      { timeout: 45_000, intervals: [1_000] }
    )
    .toBe('/account');
  await expect(page.getByTestId('settings-subrail')).toBeVisible({ timeout: 15_000 });
  await expectNoGroupsSurface(page);

  // Groups live on the switcher rail only, so Organization settings — where one
  // would look for them if they had leaked off it — must not offer them. Read
  // this surface by URL rather than by clicking the sub-rail: the teammate
  // profile panel opens itself shortly after `/account` loads, and its overlay
  // swallows clicks while leaving assertions intact.
  await page.goto('/organizations', { waitUntil: 'domcontentloaded' });
  const orgSubrail = page.getByTestId('organization-subrail');
  await expect(orgSubrail).toBeVisible({ timeout: 20_000 });
  // Text rather than role: that same overlay marks the background `aria-hidden`,
  // which would empty a role query and let the absences below pass vacuously.
  await expect(orgSubrail).toContainText('Teams');
  await expect(orgSubrail).not.toContainText('Groups');
  await expectNoGroupsSurface(page);
});
