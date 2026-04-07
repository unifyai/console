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
import { seedOrgBasic } from './scenarios/org-basic';
import { seedOrgMultiRole } from './scenarios/org-multi-role';
import { seedOrgAndOutsider } from './scenarios/org-unify';
import { seedCreditGrantLinks } from './scenarios/credit-grant-links';
import { seedBillingBannerStates } from './scenarios/billing-banner-states';
import { seedUsageLedger } from './scenarios/usage-ledger';

const SCENARIOS: Record<string, SeedScenario> = {
  'personal-workspace': seedPersonalWorkspace,
  'org-basic': seedOrgBasic,
  'org-multi-role': seedOrgMultiRole,
  'org-unify': seedOrgAndOutsider,
  'credit-grant-links': seedCreditGrantLinks,
  'billing-banner-states': seedBillingBannerStates,
  'usage-ledger': seedUsageLedger,
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
