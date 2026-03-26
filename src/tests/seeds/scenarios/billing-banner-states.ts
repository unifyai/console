/**
 * Seed Scenario: Billing Banner States
 *
 * Creates multiple users with different credit balances to manually verify
 * the out-of-credits banner renders correctly for each scenario.
 *
 * **What it creates:**
 *
 * | User              | Credits | Recharge | Expected Banner    |
 * |-------------------|---------|----------|--------------------|
 * | `grantDepleted`   | -0.50   | none     | Out of credits     |
 * | `paidDepleted`    | -2.00   | PAID     | Out of credits     |
 * | `grantRemaining`  | 73.15   | none     | (none)             |
 * | `paidRemaining`   | 50.00   | PAID     | (none)             |
 * | `brandNew`        | 0       | none     | (none)             |
 * | `zeroPaid`        | 0       | PAID     | (none)             |
 *
 * **Credentials:** Each user has email login with password `testpass123`.
 *
 * Run:
 *   npx tsx src/tests/seeds/run.ts billing-banner-states
 */

import type { SeededState } from '../types';
import { createUser, createEmailLogin, createAssistant, dbExecBlock, seedChatInfrastructure } from '../client';

export async function seedBillingBannerStates(): Promise<SeededState> {
  // --- User 1: Granted credits, fully depleted (no recharge record) ---
  const grantDepleted = createUser({
    name: 'Grant',
    lastName: 'Depleted',
    credits: -0.5,
  });
  createEmailLogin({ userId: grantDepleted.id });
  const a1 = createAssistant({ userId: grantDepleted.id, firstName: 'Ada', surname: 'One' });
  await seedChatInfrastructure({
    apiKey: grantDepleted.apiKey, userId: grantDepleted.id,
    assistantId: a1.agentId, email: grantDepleted.email,
  });

  // --- User 2: Paid recharge, fully depleted (has PAID recharge record) ---
  const paidDepleted = createUser({
    name: 'Paid',
    lastName: 'Depleted',
    credits: -2.0,
  });
  createEmailLogin({ userId: paidDepleted.id });
  const a2 = createAssistant({ userId: paidDepleted.id, firstName: 'Ada', surname: 'Two' });
  await seedChatInfrastructure({
    apiKey: paidDepleted.apiKey, userId: paidDepleted.id,
    assistantId: a2.agentId, email: paidDepleted.email,
  });
  addPaidRecharge(paidDepleted.id, 25);

  // --- User 3: Granted credits, still has balance ---
  const grantRemaining = createUser({
    name: 'Grant',
    lastName: 'Remaining',
    credits: 73.15,
  });
  createEmailLogin({ userId: grantRemaining.id });
  const a3 = createAssistant({ userId: grantRemaining.id, firstName: 'Ada', surname: 'Three' });
  await seedChatInfrastructure({
    apiKey: grantRemaining.apiKey, userId: grantRemaining.id,
    assistantId: a3.agentId, email: grantRemaining.email,
  });

  // --- User 4: Paid recharge, still has balance ---
  const paidRemaining = createUser({
    name: 'Paid',
    lastName: 'Remaining',
    credits: 50,
  });
  createEmailLogin({ userId: paidRemaining.id });
  const a4 = createAssistant({ userId: paidRemaining.id, firstName: 'Ada', surname: 'Four' });
  await seedChatInfrastructure({
    apiKey: paidRemaining.apiKey, userId: paidRemaining.id,
    assistantId: a4.agentId, email: paidRemaining.email,
  });
  addPaidRecharge(paidRemaining.id, 100);

  // --- User 5: Brand-new user, zero credits, no recharge ---
  const brandNew = createUser({
    name: 'Brand',
    lastName: 'New',
    credits: 0,
  });
  createEmailLogin({ userId: brandNew.id });
  const a5 = createAssistant({ userId: brandNew.id, firstName: 'Ada', surname: 'Five' });
  await seedChatInfrastructure({
    apiKey: brandNew.apiKey, userId: brandNew.id,
    assistantId: a5.agentId, email: brandNew.email,
  });

  // --- User 6: Zero credits but has a paid recharge (spent exactly what they bought) ---
  const zeroPaid = createUser({
    name: 'Zero',
    lastName: 'Paid',
    credits: 0,
  });
  createEmailLogin({ userId: zeroPaid.id });
  const a6 = createAssistant({ userId: zeroPaid.id, firstName: 'Ada', surname: 'Six' });
  await seedChatInfrastructure({
    apiKey: zeroPaid.apiKey, userId: zeroPaid.id,
    assistantId: a6.agentId, email: zeroPaid.email,
  });
  addPaidRecharge(zeroPaid.id, 25);

  const users = {
    grantDepleted,
    paidDepleted,
    grantRemaining,
    paidRemaining,
    brandNew,
    zeroPaid,
  };

  const credentials = Object.fromEntries(
    Object.entries(users).map(([key, u]) => [
      key,
      { email: u.email, password: 'testpass123', apiKey: u.apiKey, userId: u.id },
    ])
  );

  return {
    users,
    assistants: [a1, a2, a3, a4, a5, a6],
    credentials,
  };
}

/**
 * Insert a PAID recharge record for a user's billing account.
 */
function addPaidRecharge(userId: string, amount: number): void {
  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';
  INSERT INTO recharge (billing_account_id, type, quantity, amount_usd, status)
  VALUES (_ba_id, 'payment', ${amount}, ${amount}, 'PAID');
END
\\$\\$;
`);
}
