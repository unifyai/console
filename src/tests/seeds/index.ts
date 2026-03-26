/**
 * Modular Seed System — Entry Point
 *
 * Re-exports all seed scenarios, types, and client primitives.
 *
 * ## Usage in tests (`@real` tests)
 *
 * ```ts
 * import { seedOrgMultiRole } from '@/tests/seeds';
 *
 * let state: SeededState;
 * beforeAll(async () => {
 *   state = await seedOrgMultiRole();
 * });
 * ```
 *
 * ## Usage from CLI (via local.sh --seed)
 *
 * ```bash
 * npx tsx src/tests/seeds/run.ts org-multi-role
 * ```
 */

// Types
export type {
  SeededState,
  SeededUser,
  SeededOrg,
  SeededAssistant,
  SeededSecret,
  SeededCredentials,
  OrgRole,
  SeedScenario,
} from './types';

// Client primitives (for composing custom scenarios)
export {
  dbExec,
  dbExecBlock,
  dbExecStdin,
  apiFetch,
  orchestraFetch,
  uniqueUserId,
  uniqueEmail,
  uniqueApiKey,
  createUser,
  createOrg,
  addMember,
  createAssistant,
  createSecret,
  createEmailLogin,
  ensureVoicePreset,
  ensureProject,
  grantProjectAccessForOrg,
  seedChatInfrastructure,
  deleteUser,
  deleteOrg,
} from './client';

// Scenarios
export { seedPersonalWorkspace } from './scenarios/personal-workspace';
export { seedOrgBasic } from './scenarios/org-basic';
export { seedOrgMultiRole } from './scenarios/org-multi-role';
export { seedOrgAndOutsider } from './scenarios/org-unify';
export { seedCreditGrantLinks } from './scenarios/credit-grant-links';
export { seedBillingBannerStates } from './scenarios/billing-banner-states';

