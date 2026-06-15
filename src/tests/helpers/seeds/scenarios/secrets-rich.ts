/**
 * Seed Scenario: Secrets Rich
 *
 * Creates a user + assistant with a diverse set of secrets designed to
 * exercise every rendering path of the Secrets tab:
 *
 *   - Flat (root-level) secrets with and without descriptions
 *   - Shallow folders (e.g. `stripe/*`)
 *   - Deep nesting across multiple branches (e.g. `aws/prod/rds/*`)
 *   - Mixed depths within the same parent folder (e.g. `gcp/SERVICE_ACCOUNT_JSON`
 *     alongside `gcp/prod/*`)
 *   - Many sibling folders to test sort order
 *   - A name/folder conflict (a secret literally called `github` alongside
 *     children `github/TOKEN`, `github/WEBHOOK_SECRET`) to exercise the
 *     conflict-row path
 *   - Long descriptions that stress truncation in the description column
 *   - A deeply-nested single branch to stress indentation
 *
 * **What it creates:**
 *   - 1 user ("owner")
 *   - 1 personal assistant ("VaultBot")
 *   - 26 secrets covering the cases above
 *
 * **Credentials:**
 *   - `owner` — full access
 *
 * **Usage:**
 *   ./scripts/local.sh start --seed secrets-rich
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
  seedSecretsViaOrchestra,
  type SeedSecretEntry,
} from '../client';

// ---------------------------------------------------------------------------
// Data: Secrets
// ---------------------------------------------------------------------------

const SECRETS: SeedSecretEntry[] = [
  // ---- Root-level (flat) secrets ------------------------------------------
  {
    name: 'OPENAI_API_KEY',
    value: 'sk-test-openai-rich-scenario-0001',
    description: 'Production OpenAI key shared across all assistants.',
  },
  {
    name: 'DEBUG_TOKEN',
    value: 'debug-no-description-on-purpose',
    // no description — exercises the em-dash placeholder path
  },
  {
    name: 'DATABASE_URL',
    value: 'postgres://app:shhh@db.internal.local:5432/app_production?sslmode=require',
    description:
      'Primary application database URL — points at the production writer. Rotated quarterly; ask the platform team before touching this one, and never paste it into shared channels.',
  },

  // ---- stripe/ (shallow folder with 3 children) ---------------------------
  {
    name: 'stripe/SECRET_KEY',
    value: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
    description: 'Stripe test-mode secret key for the checkout integration.',
  },
  { name: 'stripe/PUBLISHABLE_KEY', value: 'pk_test_TYooMQauvdEDq54NiTphI7jx' },
  {
    name: 'stripe/WEBHOOK_SECRET',
    value: 'whsec_test_rich_webhook_secret_abc123',
    description: 'Signs incoming Stripe webhooks; verified by /api/webhooks/stripe.',
  },

  // ---- aws/ (deep + wide: prod/staging/dev, rds + s3 sub-folders) ---------
  {
    name: 'aws/prod/rds/MASTER_PASSWORD',
    value: 'aws-prod-rds-master-EXAMPLE',
    description: 'Master password for the prod Postgres cluster. Admin access only.',
  },
  { name: 'aws/prod/rds/READONLY_PASSWORD', value: 'aws-prod-rds-readonly-EXAMPLE' },
  {
    name: 'aws/prod/s3/ACCESS_KEY',
    value: 'AKIAIOSFODNN7EXAMPLE',
    description: 'Writes to the prod assets bucket.',
  },
  { name: 'aws/prod/s3/SECRET_KEY', value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
  { name: 'aws/staging/rds/MASTER_PASSWORD', value: 'aws-staging-rds-master-EXAMPLE' },
  { name: 'aws/staging/s3/ACCESS_KEY', value: 'AKIAI44QH8DHBEXAMPLE' },
  {
    name: 'aws/dev/SANDBOX_KEY',
    value: 'aws-dev-sandbox-EXAMPLE',
    description: 'Personal sandbox credentials — safe to rotate any time.',
  },

  // ---- gcp/ (mixed depths: direct child + nested prod/) -------------------
  {
    name: 'gcp/SERVICE_ACCOUNT_JSON',
    value:
      '{"type":"service_account","project_id":"example-rich","private_key_id":"abc","client_email":"service-account@example.iam.gserviceaccount.com"}',
    description:
      'Whole service-account JSON blob for the default project. Stored as a single secret so it can be fetched in one round-trip at boot.',
  },
  { name: 'gcp/prod/BIGQUERY_KEY', value: 'gcp-prod-bq-EXAMPLE' },
  { name: 'gcp/prod/STORAGE_KEY', value: 'gcp-prod-storage-EXAMPLE' },

  // ---- github/ (conflict case: secret AND folder share the same name) -----
  {
    name: 'github',
    value: 'ghp_legacyRootTokenThatShouldHaveBeenNamespaced',
    description: 'Legacy root-level GitHub PAT — kept around for a conflict-render test.',
  },
  {
    name: 'github/TOKEN',
    value: 'ghp_properlyNamespacedExample',
    description: 'Current GitHub personal access token used by CI.',
  },
  { name: 'github/WEBHOOK_SECRET', value: 'gh-webhook-EXAMPLE' },

  // ---- integrations/ (many sibling sub-folders to test sort order) --------
  {
    name: 'integrations/slack/BOT_TOKEN',
    value: 'xoxb-example-slack-bot-token',
    description: 'Slack bot token for the #ops channel.',
  },
  { name: 'integrations/slack/SIGNING_SECRET', value: 'slack-signing-EXAMPLE' },
  { name: 'integrations/twilio/ACCOUNT_SID', value: 'AC_twilio_example_sid' },
  {
    name: 'integrations/twilio/AUTH_TOKEN',
    value: 'twilio-auth-EXAMPLE',
    description: 'Paired with ACCOUNT_SID to sign Twilio API requests.',
  },
  { name: 'integrations/sendgrid/API_KEY', value: 'SG.example_sendgrid_api_key' },
  { name: 'integrations/zendesk/API_TOKEN', value: 'zd-example-api-token' },

  // ---- Very deep single branch (stresses indentation) ---------------------
  {
    name: 'legacy/v1/auth/jwt/HS256_SIGNING_KEY',
    value: 'legacy-jwt-hs256-EXAMPLE',
    description: 'Do not rotate without coordinating with the v1 mobile app team.',
  },
];

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export async function seedSecretsRich(): Promise<SeededState> {
  const owner = createUser({ name: 'Secrets', lastName: 'Keeper', credits: 50_000 });
  createEmailLogin({ userId: owner.id });

  const assistant = createAssistant({
    userId: owner.id,
    firstName: 'VaultBot',
    surname: 'Keeper',
  });

  await seedChatInfrastructure({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  // Make the auto-provisioned personal Coordinator chat-ready.
  await seedCoordinatorChatForUsers([owner]);

  const secrets = await seedSecretsViaOrchestra({
    apiKey: owner.apiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    secrets: SECRETS,
  });

  return {
    users: { owner },
    assistants: [assistant],
    secrets,
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
