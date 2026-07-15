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
  SeededTeam,
  SeededSecret,
  SeededUserDesktop,
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
  apiJson,
  orchestraFetch,
  uniqueUserId,
  uniqueEmail,
  uniqueApiKey,
  createUser,
  createOrg,
  addMember,
  createAssistant,
  createUserDesktop,
  linkUserDesktop,
  createTeamForAssistant,
  addAssistantToTeam,
  createChatGroup,
  createSecret,
  seedSecretsViaOrchestra,
  createEmailLogin,
  ensureVoicePreset,
  ensureProject,
  grantProjectAccessForOrg,
  seedChatInfrastructure,
  seedManagerMethodEvents,
  seedToolLoopEvents,
  deleteUser,
  deleteOrg,
  // Real test helpers
  isServerReachable,
  skipIfServerNotReachable,
  ApiError,
  realTestOptions,
  realTestOptionsExtended,
} from './client';

// Scenarios
export { seedPersonalWorkspace } from './scenarios/personal-workspace';
export { seedDesktopLinked } from './scenarios/desktop-linked';
export { seedOrgBasic } from './scenarios/org-basic';
export { seedOrgChatGroups } from './scenarios/org-chat-groups';
export { seedOrgMultiRole } from './scenarios/org-multi-role';
export { seedOrgAndOutsider } from './scenarios/org-unify';
export { seedCreditGrantLinks } from './scenarios/credit-grant-links';
export { seedBillingBannerStates } from './scenarios/billing-banner-states';
export { seedManualTopup } from './scenarios/manual-topup';
export { seedUsageLedger } from './scenarios/usage-ledger';
export { seedChatSearch } from './scenarios/chat-search';
export { seedBrainRich } from './scenarios/brain-rich';
export { seedTasksRich } from './scenarios/tasks-rich';
export { seedReAppraisal } from './scenarios/re-appraisal';
