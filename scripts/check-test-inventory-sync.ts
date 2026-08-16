#!/usr/bin/env npx tsx
/**
 * Ensures every @critical test in PR/push tier specs is registered in test-registry capabilities,
 * that every P0 @critical test sits in a tier spec list, and that every @push test lives in the
 * push-gate pool within pushGateMaxTests.
 * Run: npm run check:test-inventory
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  capabilities,
  defaultPriorityForSpec,
  parseTestTags,
  removedSpecFiles,
  type AreaPriority,
} from '../src/tests/test-registry';

const ROOT = path.resolve(__dirname, '..');
const TEST_RE = /(?:^|\n)\s*(?:test|(?:\w+)Test)\(\s*['"`]([^'"`]+)['"`]/g;

function listTaggedTests(relativePath: string, tag: 'critical' | 'push'): string[] {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) return [];
  const content = fs.readFileSync(full, 'utf8');
  const titles: string[] = [];
  let m: RegExpExecArray | null;
  TEST_RE.lastIndex = 0;
  while ((m = TEST_RE.exec(content)) !== null) {
    const tags = parseTestTags(m[1]);
    if (tag === 'critical' ? tags.critical : tags.push) {
      titles.push(m[1]);
    }
  }
  return titles;
}

/** Mirrors the sampler in ci-playwright-list-tests.ts so the gate and the guard agree. */
function priorityForTest(specPath: string, title: string): AreaPriority {
  const { areaId } = parseTestTags(title);
  const tagged = areaId ? capabilities.find((c) => c.areaId === areaId)?.priority : undefined;
  return tagged ?? defaultPriorityForSpec(specPath);
}

function tierSpecs(tier: string): string[] {
  const out = execSync(`bash scripts/ci-playwright-tiers.sh ${tier}`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.e2e.ts') && !removedSpecFiles.includes(line));
}

function allTierSpecs(): string[] {
  const tiers = [
    'push-gate',
    'pr-auth',
    'pr-billing',
    'pr-account',
    'pr-assistants',
    'pr-shell-admin',
  ];
  const specs = new Set<string>();
  for (const tier of tiers) {
    for (const spec of tierSpecs(tier)) {
      specs.add(spec);
    }
  }
  return [...specs];
}

const manifestPath = path.join(ROOT, 'scripts/ci-playwright-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  pushGateMaxTests?: number;
};
const pushGateMaxTests = manifest.pushGateMaxTests ?? 25;

const registryTitles = new Set(capabilities.flatMap((c) => c.matchers.map((m) => m.titleIncludes)));

const missing: string[] = [];
for (const spec of allTierSpecs()) {
  for (const title of listTaggedTests(spec, 'critical')) {
    const clean = title
      .replace(/@push/g, '')
      .replace(/@critical/g, '')
      .replace(/@area\([^)]*\)/g, '')
      .trim();
    const matched = [...registryTitles].some(
      (needle) => clean.includes(needle) || title.includes(needle)
    );
    if (!matched) {
      missing.push(`${spec}: ${clean}`);
    }
  }
}

const pushPool = new Set(tierSpecs('push-gate'));
const pushTests: string[] = [];
for (const spec of pushPool) {
  for (const title of listTaggedTests(spec, 'push')) {
    pushTests.push(`${spec}: ${title}`);
  }
}

const orphanPush: string[] = [];
const allE2e = execSync('find src/tests -name "*.e2e.ts" | sort', {
  cwd: ROOT,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

for (const spec of allE2e) {
  if (removedSpecFiles.includes(spec)) continue;
  for (const title of listTaggedTests(spec, 'push')) {
    if (!pushPool.has(spec)) {
      orphanPush.push(
        `${spec}: ${title
          .replace(/@push/g, '')
          .replace(/@critical/g, '')
          .trim()}`
      );
    }
  }
}

// @critical only selects tests inside the tier file lists, so a P0 journey in a
// spec no tier lists never reaches a merge gate — the tag reads as a guarantee
// it cannot keep. P1/P2 specs may stay exhaustive-only; there the tag marks the
// coverage floor that test-registry.ts enforces by title.
const tierPool = new Set(allTierSpecs());
const unreachableCritical: string[] = [];
for (const spec of allE2e) {
  if (removedSpecFiles.includes(spec) || tierPool.has(spec)) continue;
  for (const title of listTaggedTests(spec, 'critical')) {
    if (priorityForTest(spec, title) === 'P0') {
      unreachableCritical.push(`${spec}: ${title}`);
    }
  }
}

if (missing.length > 0) {
  console.error('@critical tests missing from TEST_COVERAGE_MAP / test-registry:');
  for (const line of missing) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

if (unreachableCritical.length > 0) {
  console.error(
    'P0 @critical tests must be in a PR/push tier spec list (scripts/ci-playwright-tiers.sh);\n' +
      'otherwise drop @critical and leave the spec exhaustive-only:'
  );
  for (const line of unreachableCritical) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

if (orphanPush.length > 0) {
  console.error('@push tests must be in push-gate spec pool (scripts/ci-playwright-tiers.sh):');
  for (const line of orphanPush) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

if (pushTests.length === 0) {
  console.error('No @push tests found in push-gate pool.');
  process.exit(1);
}

if (pushTests.length > pushGateMaxTests) {
  console.error(
    `@push test count ${pushTests.length} exceeds pushGateMaxTests (${pushGateMaxTests}).`
  );
  for (const line of pushTests) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(
  `check:test-inventory OK — ${allTierSpecs().length} tier specs, ${pushTests.length} @push tests, critical tests registered`
);
