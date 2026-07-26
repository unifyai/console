/**
 * MS Teams bot bind-handshake E2E.
 *
 * A Teams Store install lands in Orchestra as a **pending** row (no
 * owner) carrying a one-time bind nonce. An org owner claims it from the
 * assistant contact manager's "Microsoft Teams (bot)" section by entering
 * the nonce, which binds the pending install to their organization.
 *
 * This drives that flow through the real UI as an org owner and asserts
 * both the UI (connected status) and the database (install now bound to
 * the org, no longer pending).
 *
 * Run: npx playwright test src/tests/ms-teams-bot/bind.e2e.ts
 */

import { test as base, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import {
  createOrg,
  createAssistant,
  deleteOrg,
  ensureProjectSync,
  createMsTeamsBotInstall,
  getMsTeamsBotInstallState,
  deleteMsTeamsBotInstall,
  navigateToAssistants,
  openUnitySwitcher,
  closeHireDialogIfOpen,
  openContactManagerFromList,
} from '../assistants/helpers';

// =============================================================================
// Seed: org owner + org assistant + a pending Teams bot install
// =============================================================================

const owner = createTestUser({ name: 'TeamsBot', lastName: 'Owner', credits: 50_000 });
const org = createOrg({ name: `TeamsBotOrg_${Date.now()}`, ownerId: owner.id });
ensureProjectSync(org.ownerOrgApiKey);

const orgAssistant = createAssistant({
  userId: owner.id,
  orgId: org.id,
  firstName: 'TeamsBot',
  surname: 'Assistant',
});

const install = createMsTeamsBotInstall({
  tenantId: `teams-bot-e2e-tenant-${Date.now()}`,
  tenantName: 'Teams Bot E2E Tenant',
  bindNonce: `teams-bot-e2e-nonce-${Date.now()}`,
});

// =============================================================================
// Login as the org owner in the org workspace
// =============================================================================

async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(os.tmpdir(), `pw-teamsbot-${email.replace(/[^a-z0-9]/gi, '-')}.json`);

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
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await deferCoordinatorAfterAssistantsLoad(page, owner.id, owner.apiKey);
  await dismissCoordinatorOnboardingIfOpen(page);
  await expect(page.getByTestId('assistant-rail').first()).toBeVisible({ timeout: 20_000 });

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
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

test.setTimeout(90_000);

test.afterAll(() => {
  deleteMsTeamsBotInstall(install.id);
  try {
    deleteOrg(org.id);
  } catch {
    /* best effort — cascades assistants */
  }
  cleanupUser(owner.id);
});

// =============================================================================
// Test
// =============================================================================

test('org owner binds a pending Teams bot install to the org @area(assistants.integrations)', async ({
  ownerPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await openContactManagerFromList(page, orgAssistant.agentId);

  const section = page.locator('[data-contact-section="ms_teams_bot"]');
  await expect(section).toBeVisible({ timeout: 10_000 });

  // Pre-bind: the install is pending, so the bind form is shown.
  const nonceInput = section.getByTestId('ms-teams-bot-nonce-input');
  await expect(nonceInput).toBeVisible({ timeout: 5_000 });
  await nonceInput.fill(install.bindNonce ?? '');

  await section.getByTestId('ms-teams-bot-bind-button').click();

  // UI reflects the bound install.
  await expect(section.getByText('Teams Bot E2E Tenant')).toBeVisible({ timeout: 15_000 });

  // DB reflects the bind: install now owned by the org, no longer pending.
  await expect
    .poll(() => getMsTeamsBotInstallState(install.id)?.organizationId, { timeout: 15_000 })
    .toBe(org.id);

  const state = getMsTeamsBotInstallState(install.id);
  expect(state?.pending).toBe(false);
  expect(state?.revoked).toBe(false);
});
