/**
 * Seed Scenario: Manual Top-Up (staging billing mode)
 *
 * Exercises the manual-top-up billing mode (staging): credits meter and gate
 * work exactly as in production, but are replenished for free via the billing
 * page's "Top up" control — no Stripe, no card, no charge.
 *
 * Requires the stack to run in manual-top-up mode so Console resolves
 * `features.manualTopup` (and therefore `features.billing`) to true:
 *
 *   MANUAL_TOPUP=1 ./scripts/local.sh start --seed manual-topup
 *
 * **What it creates:**
 *
 * | User           | Credits | Purpose                                  |
 * |----------------|---------|------------------------------------------|
 * | `lowBalance`   | 5       | Top up from a small positive balance     |
 * | `depleted`     | 0       | Out-of-credits banner + top-up to recover |
 *
 * **Credentials:** Each user has email login with password `testpass123`.
 *
 * Run:
 *   npx tsx src/tests/helpers/seeds/run.ts manual-topup
 */

import type { SeededState } from '../types';
import {
  createUser,
  createEmailLogin,
  createAssistant,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
} from '../client';

export async function seedManualTopup(): Promise<SeededState> {
  // --- User 1: small positive balance, tops up to add more ---
  const lowBalance = createUser({
    name: 'Manual',
    lastName: 'Topup',
    credits: 5,
  });
  createEmailLogin({ userId: lowBalance.id });
  const a1 = createAssistant({ userId: lowBalance.id, firstName: 'Ada', surname: 'Topup' });
  await seedChatInfrastructure({
    apiKey: lowBalance.apiKey,
    userId: lowBalance.id,
    assistantId: a1.agentId,
    email: lowBalance.email,
  });

  // --- User 2: depleted balance, shows out-of-credits then recovers via top-up ---
  const depleted = createUser({
    name: 'Manual',
    lastName: 'Depleted',
    credits: 0,
  });
  createEmailLogin({ userId: depleted.id });
  const a2 = createAssistant({ userId: depleted.id, firstName: 'Ada', surname: 'Depleted' });
  await seedChatInfrastructure({
    apiKey: depleted.apiKey,
    userId: depleted.id,
    assistantId: a2.agentId,
    email: depleted.email,
  });

  const users = { lowBalance, depleted };

  await seedCoordinatorChatForUsers(Object.values(users));

  const credentials = Object.fromEntries(
    Object.entries(users).map(([key, u]) => [
      key,
      { email: u.email, password: 'testpass123', apiKey: u.apiKey, userId: u.id },
    ])
  );

  return {
    users,
    assistants: [a1, a2],
    credentials,
  };
}
