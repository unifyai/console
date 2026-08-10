/**
 * Account Reset E2E — staging-only "reset my account" staff tool.
 *
 * Exercises the full flow for a Unify-org staff member:
 *   - Seed a "dirty" personal workspace: a hired assistant alongside the
 *     auto-provisioned Coordinator (T-W1N), plus phone/WhatsApp/Discord contact
 *     details on the user.
 *   - Open the rail account menu and pick "Reset account", then confirm.
 *   - The workspace rewinds to its fresh-signup state.
 *
 * Verifies the mutation in the DB (source of truth — the UI can be optimistic):
 * the hired assistant is gone, exactly one personal Coordinator remains (freshly
 * re-provisioned), contact details beyond email are cleared, onboarding is
 * rewound, and — critically for the chosen scope — credits and the Unify-org
 * membership are left untouched.
 *
 * The tool is staging-only. Console resolves `features.accountReset` from
 * Orchestra, which reports it in staging or when `ACCOUNT_RESET=1` is set:
 *
 *   ACCOUNT_RESET=1 ./scripts/local.sh start
 *
 * When the mode is off the menu item is absent, so the test skips itself with a
 * clear message rather than failing spuriously (mirrors `manual-topup.e2e.ts`).
 *
 * Run: npx playwright test src/tests/account/reset-account.e2e.ts
 */

import { expect, test as base, type Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  createTestUser,
  cleanupUser,
  createOrg,
  deleteOrg,
  loginAndWaitForRedirect,
  completeAccountOnboardingIfPresent,
} from '../auth/helpers';
import { createAssistant, addMember, dbExec } from '../helpers/seeds/client';
import { railAccountTrigger } from '../helpers/shell';

// ---------------------------------------------------------------------------
// Seed (module scope, synchronous)
// ---------------------------------------------------------------------------

// Unify staff member — must belong to an org literally named "Unify" AND
// carry a unify.ai mailbox, the two signals the membership gate now keys
// off. The org name is globally unique, so reuse an existing "Unify" org if
// present and otherwise create one.
const staffUser = createTestUser({
  name: 'Reset',
  lastName: 'Victim',
  credits: 7500,
  email: `reset-staff-${Date.now()}@unify.ai`,
});
const resetDiscordId = `seed-discord-${staffUser.id.slice(0, 8)}`;

const existingUnifyOrgId = dbExec(`SELECT id FROM organization WHERE name = 'Unify' LIMIT 1;`);
let unifyOrgId: number;
let createdUnifyOrg = false;
if (existingUnifyOrgId) {
  unifyOrgId = parseInt(existingUnifyOrgId, 10);
  addMember({ orgId: unifyOrgId, userId: staffUser.id, role: 'Member' });
} else {
  unifyOrgId = createOrg({ name: 'Unify', ownerId: staffUser.id }).id;
  createdUnifyOrg = true;
}

// The auto-provisioned personal Coordinator, plus a hired teammate to prove
// deletion, plus contact details beyond the email to prove they're wiped.
const seededCoordinatorId = staffUser.coordinator?.agentId ?? null;
createAssistant({ userId: staffUser.id, firstName: 'Hired', surname: 'Helper' });
dbExec(
  `UPDATE "user" SET phone_number = '+14155550100', whatsapp_number = '+14155550101', ` +
    `discord_id = '${resetDiscordId}' WHERE id = '${staffUser.id}';`
);

// ---------------------------------------------------------------------------
// Auth fixture (login once, reuse storageState)
// ---------------------------------------------------------------------------

let authFile: string | undefined;

const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use, testInfo) => {
    if (!authFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      authFile = path.join(
        os.tmpdir(),
        `pw-reset-${staffUser.email.replace(/[^a-z0-9]/gi, '-')}.json`
      );
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto('/login');
      await loginAndWaitForRedirect(p, staffUser.email, staffUser.password, 30_000);
      await completeAccountOnboardingIfPresent(p);
      await ctx.storageState({ path: authFile });
      await ctx.close();
    }
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

test.afterAll(() => {
  if (createdUnifyOrg) deleteOrg(unifyOrgId);
  cleanupUser(staffUser.id);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function personalAssistantCount(coordinator: boolean): number {
  const flag = coordinator ? 'TRUE' : 'FALSE';
  return parseInt(
    dbExec(
      `SELECT count(*) FROM assistants WHERE user_id = '${staffUser.id}' ` +
        `AND organization_id IS NULL AND is_coordinator = ${flag};`
    ),
    10
  );
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('Unify member resets their account back to fresh-signup state @critical @area(account.reset)', async ({
  authedPage: page,
}) => {
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });

  // Open the rail account menu; skip cleanly if the staging-only tool is off.
  await railAccountTrigger(page).click();
  const resetItem = page.getByTestId('reset-account-menu-item');
  if (!(await resetItem.isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip(true, 'Account reset not enabled (set ACCOUNT_RESET=1 on Orchestra).');
    return;
  }

  // Pre-state sanity: the hired teammate is present.
  expect(personalAssistantCount(false)).toBe(1);

  await resetItem.click();
  await expect(page.getByTestId('reset-account-dialog')).toBeVisible();
  await page.getByTestId('reset-account-confirm').click();

  // Reset redirects to /assistants once the workspace is rewound.
  await page.waitForURL(/\/assistants/, { timeout: 30_000 });

  // DB is the source of truth for the mutation.
  await expect.poll(() => personalAssistantCount(false), { timeout: 20_000 }).toBe(0);
  expect(personalAssistantCount(true)).toBe(1);

  // The Coordinator was torn down and re-provisioned, so it's a fresh row.
  const newCoordinatorId = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${staffUser.id}' ` +
      `AND organization_id IS NULL AND is_coordinator = TRUE LIMIT 1;`
  );
  expect(newCoordinatorId).toBeTruthy();
  if (seededCoordinatorId !== null) {
    expect(newCoordinatorId).not.toBe(String(seededCoordinatorId));
  }

  // Contact details beyond the email are cleared; email is preserved.
  const contacts = dbExec(
    `SELECT COALESCE(phone_number, '') || '|' || COALESCE(whatsapp_number, '') || '|' || ` +
      `COALESCE(discord_id, '') FROM "user" WHERE id = '${staffUser.id}';`
  );
  expect(contacts).toBe('||');
  expect(dbExec(`SELECT email FROM "user" WHERE id = '${staffUser.id}';`)).toBe(staffUser.email);

  // Onboarding is rewound to the fresh-signup step.
  expect(
    dbExec(`SELECT current_step FROM onboarding_status WHERE user_id = '${staffUser.id}';`)
  ).toBe('heard_about');

  // Chosen scope: credits and the Unify-org membership are left untouched.
  expect(
    dbExec(
      `SELECT ba.credits FROM billing_account ba ` +
        `JOIN "user" u ON u.billing_account_id = ba.id WHERE u.id = '${staffUser.id}';`
    )
  ).toBe('7500');
  expect(
    dbExec(
      `SELECT count(*) FROM organization_member WHERE organization_id = ${unifyOrgId} ` +
        `AND user_id = '${staffUser.id}';`
    )
  ).toBe('1');

  // UI reflects the reset: the hired teammate is gone, T-W1N remains.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Hired Helper')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText('T-W1N').first()).toBeVisible({ timeout: 20_000 });
});
