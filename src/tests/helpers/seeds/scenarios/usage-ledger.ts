/**
 * Seed Scenario: Usage Ledger
 *
 * Creates a user with a rich set of credit transactions across multiple
 * categories and time periods, ideal for manually testing the Usage page
 * (chart, ledger, filters, granularity).
 *
 * **What it creates:**
 *   - 1 user ("owner") with 5 000 credits, billing account + API key
 *   - 1 personal assistant
 *   - ~30 credit_transaction rows spanning the last 14 days:
 *     - `llm`       — small frequent deductions (Assistant work)
 *     - `hire`      — occasional assistant creation fees
 *     - `resources` — contact provisioning charges
 *     - `media`     — photo/video generation costs
 *     - `recharge`  — one credit top-up (positive amount)
 *
 * **Credentials:**
 *   - `owner` — full access
 *
 * Run:
 *   npx tsx src/tests/helpers/seeds/run.ts usage-ledger
 *   ./scripts/local.sh start --seed usage-ledger
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
  dbExec,
  dbExecBlock,
} from '../client';

interface TxnSeed {
  daysAgo: number;
  hoursAgo?: number;
  amount: number;
  category: string;
  description: string;
}

const TRANSACTIONS: TxnSeed[] = [
  // --- Today ---
  { daysAgo: 0, hoursAgo: 1, amount: -0.03, category: 'llm', description: 'Assistant work' },
  { daysAgo: 0, hoursAgo: 2, amount: -0.07, category: 'llm', description: 'Assistant work' },
  { daysAgo: 0, hoursAgo: 3, amount: -0.5, category: 'media', description: 'Photo generation' },

  // --- Yesterday ---
  { daysAgo: 1, hoursAgo: 4, amount: -0.12, category: 'llm', description: 'Assistant work' },
  { daysAgo: 1, hoursAgo: 8, amount: -0.08, category: 'llm', description: 'Assistant work' },
  {
    daysAgo: 1,
    hoursAgo: 12,
    amount: -2.0,
    category: 'resources',
    description: 'Contact provisioning',
  },

  // --- 2 days ago ---
  { daysAgo: 2, hoursAgo: 6, amount: -0.15, category: 'llm', description: 'Assistant work' },
  { daysAgo: 2, hoursAgo: 10, amount: -10.0, category: 'hire', description: 'Assistant creation' },
  { daysAgo: 2, hoursAgo: 14, amount: -0.04, category: 'llm', description: 'Assistant work' },

  // --- 3 days ago ---
  { daysAgo: 3, hoursAgo: 3, amount: -0.22, category: 'llm', description: 'Assistant work' },
  { daysAgo: 3, hoursAgo: 9, amount: -1.5, category: 'media', description: 'Video generation' },
  { daysAgo: 3, hoursAgo: 15, amount: -0.06, category: 'llm', description: 'Assistant work' },

  // --- 5 days ago ---
  { daysAgo: 5, hoursAgo: 2, amount: -0.09, category: 'llm', description: 'Assistant work' },
  {
    daysAgo: 5,
    hoursAgo: 7,
    amount: -2.0,
    category: 'resources',
    description: 'Contact provisioning',
  },
  { daysAgo: 5, hoursAgo: 11, amount: -0.18, category: 'llm', description: 'Assistant work' },

  // --- 7 days ago (a week back) ---
  { daysAgo: 7, hoursAgo: 1, amount: -10.0, category: 'hire', description: 'Assistant creation' },
  { daysAgo: 7, hoursAgo: 5, amount: -0.11, category: 'llm', description: 'Assistant work' },
  { daysAgo: 7, hoursAgo: 9, amount: -0.35, category: 'llm', description: 'Assistant work' },
  { daysAgo: 7, hoursAgo: 16, amount: -0.75, category: 'media', description: 'Photo generation' },

  // --- 10 days ago ---
  { daysAgo: 10, hoursAgo: 3, amount: 100.0, category: 'recharge', description: 'Credit top-up' },
  { daysAgo: 10, hoursAgo: 6, amount: -0.14, category: 'llm', description: 'Assistant work' },
  {
    daysAgo: 10,
    hoursAgo: 10,
    amount: -2.0,
    category: 'resources',
    description: 'Contact provisioning',
  },
  { daysAgo: 10, hoursAgo: 14, amount: -0.06, category: 'llm', description: 'Assistant work' },

  // --- 12 days ago ---
  { daysAgo: 12, hoursAgo: 2, amount: -0.42, category: 'llm', description: 'Assistant work' },
  { daysAgo: 12, hoursAgo: 8, amount: -1.0, category: 'media', description: 'Photo generation' },
  { daysAgo: 12, hoursAgo: 13, amount: -0.09, category: 'llm', description: 'Assistant work' },

  // --- 14 days ago ---
  { daysAgo: 14, hoursAgo: 4, amount: -10.0, category: 'hire', description: 'Assistant creation' },
  { daysAgo: 14, hoursAgo: 10, amount: -0.25, category: 'llm', description: 'Assistant work' },
  {
    daysAgo: 14,
    hoursAgo: 16,
    amount: -2.0,
    category: 'resources',
    description: 'Contact provisioning',
  },
];

function seedTransactions(userId: string, baId: string): void {
  const values = TRANSACTIONS.map((tx) => {
    const interval = `'${tx.daysAgo} days ${tx.hoursAgo ?? 0} hours'`;
    return `(_ba, '${userId}', ${tx.amount}, '${tx.category}', '${tx.description}', NOW() - INTERVAL ${interval})`;
  }).join(',\n    ');

  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba integer := ${baId};
BEGIN
  INSERT INTO credit_transaction
    (billing_account_id, user_id, amount, category, description, at)
  VALUES
    ${values};
END
\\$\\$;
`);
}

export async function seedUsageLedger(): Promise<SeededState> {
  const owner = createUser({ name: 'Usage', lastName: 'Tester', credits: 5_000 });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'Ada',
    surname: 'Lovelace',
  });

  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  const baId = dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${owner.id}'`);

  seedTransactions(owner.id, baId);

  // Coordinator chat (auto-provisioned by createUser) — wire so the
  // Coordinator can be exercised alongside the ledger UI.
  await seedCoordinatorChatForUsers([owner]);

  return {
    users: { owner },
    assistants: [assistant],
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: owner.apiKey,
        userId: owner.id,
      },
    },
  };
}
