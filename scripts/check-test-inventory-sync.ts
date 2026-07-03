#!/usr/bin/env npx tsx
/**
 * Ensures every @critical test in PR/push tier specs is registered in test-registry capabilities.
 * Run: npm run check:test-inventory
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { capabilities, parseTestTags, removedSpecFiles } from '../src/tests/test-registry';

const ROOT = path.resolve(__dirname, '..');
const TEST_RE = /(?:^|\n)\s*(?:test|(?:\w+)Test)\(\s*['"`]([^'"`]+)['"`]/g;

function listCriticalTests(relativePath: string): string[] {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) return [];
  const content = fs.readFileSync(full, 'utf8');
  const titles: string[] = [];
  let m: RegExpExecArray | null;
  TEST_RE.lastIndex = 0;
  while ((m = TEST_RE.exec(content)) !== null) {
    if (parseTestTags(m[1]).critical) {
      titles.push(m[1]);
    }
  }
  return titles;
}

function tierSpecs(): string[] {
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
    const out = execSync(`bash scripts/ci-playwright-tiers.sh ${tier}`, {
      cwd: ROOT,
      encoding: 'utf8',
    });
    for (const line of out.trim().split('\n')) {
      if (line.endsWith('.e2e.ts')) specs.add(line.trim());
    }
  }
  return [...specs].filter((s) => !removedSpecFiles.includes(s));
}

const registryTitles = new Set(capabilities.flatMap((c) => c.matchers.map((m) => m.titleIncludes)));

const missing: string[] = [];
for (const spec of tierSpecs()) {
  for (const title of listCriticalTests(spec)) {
    const clean = title
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

if (missing.length > 0) {
  console.error('@critical tests missing from TEST_COVERAGE_MAP / test-registry:');
  for (const line of missing) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(
  `check:test-inventory OK — ${tierSpecs().length} tier specs, critical tests registered`
);
