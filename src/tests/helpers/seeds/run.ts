#!/usr/bin/env npx tsx
/**
 * CLI runner for seed scenarios.
 *
 * Usage:
 *   npx tsx src/tests/seeds/run.ts <scenario>
 *   npx tsx src/tests/seeds/run.ts --list
 *
 * Examples:
 *   npx tsx src/tests/seeds/run.ts personal-workspace
 *   npx tsx src/tests/seeds/run.ts org-basic
 *   npx tsx src/tests/seeds/run.ts org-multi-role
 *   npx tsx src/tests/seeds/run.ts all
 */

import type { SeedScenario, SeededState } from './types';
import { seedPersonalWorkspace } from './scenarios/personal-workspace';
import { seedPersonalWorkspaceMulti } from './scenarios/personal-workspace-multi';
import { seedDesktopLinked } from './scenarios/desktop-linked';
import { seedOrgBasic } from './scenarios/org-basic';
import { seedOrgChatGroups } from './scenarios/org-chat-groups';
import { seedOrgMultiRole } from './scenarios/org-multi-role';
import { seedOrgAndOutsider } from './scenarios/org-unify';
import { seedCreditGrantLinks } from './scenarios/credit-grant-links';
import { seedBillingBannerStates } from './scenarios/billing-banner-states';
import { seedManualTopup } from './scenarios/manual-topup';
import { seedUsageLedger } from './scenarios/usage-ledger';
import { seedChatSearch } from './scenarios/chat-search';
import { seedBrainRich } from './scenarios/brain-rich';
import { seedTasksRich } from './scenarios/tasks-rich';
import { seedSecretsRich } from './scenarios/secrets-rich';
import { seedReAppraisal } from './scenarios/re-appraisal';
import { seedManagedBilling } from './scenarios/managed-billing';
import { seedSidebarTeamGrouping } from './scenarios/sidebar-team-grouping';
import { seedReferrals } from './scenarios/referrals';

const SCENARIOS: Record<string, SeedScenario> = {
  'personal-workspace': seedPersonalWorkspace,
  'personal-workspace-multi': seedPersonalWorkspaceMulti,
  'desktop-linked': seedDesktopLinked,
  'sidebar-team-grouping': seedSidebarTeamGrouping,
  'org-basic': seedOrgBasic,
  'org-chat-groups': seedOrgChatGroups,
  'org-multi-role': seedOrgMultiRole,
  'org-unify': seedOrgAndOutsider,
  'credit-grant-links': seedCreditGrantLinks,
  referrals: seedReferrals,
  'billing-banner-states': seedBillingBannerStates,
  'manual-topup': seedManualTopup,
  'managed-billing': seedManagedBilling,
  'usage-ledger': seedUsageLedger,
  'chat-search': seedChatSearch,
  'brain-rich': seedBrainRich,
  'tasks-rich': seedTasksRich,
  'secrets-rich': seedSecretsRich,
  're-appraisal': seedReAppraisal,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx src/tests/seeds/run.ts <scenario|all|--list>

Available scenarios:
  ${Object.keys(SCENARIOS).join('\n  ')}
  all  — run all scenarios

Options:
  --list   List available scenarios
  --help   Show this help
`);
    process.exit(0);
  }

  if (args.includes('--list')) {
    console.log('Available seed scenarios:');
    for (const name of Object.keys(SCENARIOS)) {
      console.log(`  - ${name}`);
    }
    process.exit(0);
  }

  const toRun = args.includes('all') ? Object.keys(SCENARIOS) : args;
  const results: { name: string; state: SeededState }[] = [];

  for (const scenarioName of toRun) {
    const scenario = SCENARIOS[scenarioName];
    if (!scenario) {
      console.error(`Unknown scenario: "${scenarioName}"`);
      console.error(`Available: ${Object.keys(SCENARIOS).join(', ')}`);
      process.exit(1);
    }

    console.log(`\n🌱 Seeding: ${scenarioName} ...`);
    const startMs = Date.now();

    try {
      const state = await scenario();
      const elapsedMs = Date.now() - startMs;
      results.push({ name: scenarioName, state });

      console.log(`   ✅ Done in ${elapsedMs}ms`);
      console.log(`   Users:      ${Object.keys(state.users).join(', ')}`);
      if (state.org) {
        console.log(`   Org:        ${state.org.name} (id=${state.org.id})`);
      }
      console.log(`   Assistants: ${state.assistants.length}`);
      const coordinatorCount = Object.values(state.users).filter((u) => u.coordinator).length;
      if (coordinatorCount > 0) {
        console.log(`   Coordinators: ${coordinatorCount} (one per user)`);
      }
      if (state.secrets?.length) {
        console.log(`   Secrets:    ${state.secrets.map((s) => s.name).join(', ')}`);
      }
      console.log(`   Credentials:`);
      for (const [label, cred] of Object.entries(state.credentials)) {
        console.log(`     ${label}:`);
        console.log(`       email:    ${cred.email}`);
        console.log(`       password: ${cred.password}`);
        console.log(`       apiKey:   ${cred.apiKey}`);
        console.log(`       userId:   ${cred.userId}`);
      }
    } catch (err) {
      console.error(`   ❌ Failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 All seeds completed.\n');
  console.log('💡 DevQuickLogin will discover these users automatically from the database.\n');
}

main();
