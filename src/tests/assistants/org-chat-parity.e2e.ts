/**
 * Org chat chrome parity: real (human) DM surface matches virtual chat
 * toolbar/composer affordances (search, call, attach).
 *
 * Run: npx playwright test src/tests/assistants/org-chat-parity.e2e.ts
 */
import { test as base, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';
import { createOrg, addMember, ensureProjectSync } from '../helpers/seeds/client';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail } from '../helpers/shell';

const owner = createTestUser({ name: 'ChatParity', lastName: 'Owner', credits: 50_000 });
const member = createTestUser({ name: 'ChatParity', lastName: 'Member', credits: 50_000 });
const org = createOrg({ name: `ChatParityOrg_${Date.now()}`, ownerId: owner.id });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });
ensureProjectSync(org.ownerOrgApiKey);

async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-org-chat-parity-${email.replace(/[^a-z0-9]/gi, '-')}.json`
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

test('real DM chat shows virtual-parity chrome', async ({ ownerPage: page }) => {
  test.setTimeout(90_000);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  const humanRow = page.getByTestId(`human-list-item-${member.id}`);
  await expect(humanRow).toBeVisible({ timeout: 30_000 });
  await humanRow.click();

  await expect(page.getByTestId('human-workspace')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('org-chat-panel')).toBeVisible();
  await expect(page.getByTestId('org-chat-search')).toBeVisible();
  await expect(page.getByTestId('org-chat-call-button')).toBeVisible();
  await expect(page.getByTestId('org-chat-attach-button')).toBeVisible();
  await expect(page.getByTestId('org-chat-composer')).toBeVisible();
  await expect(page.getByTestId('org-chat-send')).toBeVisible();

  await page.getByTestId('org-chat-search').click();
  await expect(page.getByTestId('org-chat-search-dialog')).toBeVisible({ timeout: 5_000 });
});
