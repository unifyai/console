#!/usr/bin/env npx tsx
/**
 * Emits per-test inventory rows for all E2E specs (static parse).
 * Run: npx tsx scripts/generate-e2e-inventory.ts > src/tests/TEST_INVENTORY.generated.md
 */

import { execSync } from 'child_process';
import path from 'path';
import {
  defaultPriorityForSpec,
  parseTestTags,
  removedSpecFiles,
} from '../src/tests/test-registry';

const ROOT = path.resolve(__dirname, '..');

function allSpecs(): string[] {
  const out = execSync('find src/tests -name "*.e2e.ts" | sort', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .trim()
    .split('\n')
    .filter((f) => f && !removedSpecFiles.includes(f));
}

const specs = allSpecs();
const list = execSync(`LIST_ALL=1 npx tsx scripts/ci-playwright-list-tests.ts ${specs.join(' ')}`, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

console.log('# Generated E2E Test Inventory\n');
console.log('| Spec | Test | @critical | Default P |');
console.log('|------|------|-----------|-----------|');

for (const line of list.trim().split('\n')) {
  if (!line) continue;
  const [file, title, criticalFlag] = line.split('|');
  const tags = parseTestTags(title);
  const p = defaultPriorityForSpec(file);
  const clean = title
    .replace(/@critical/g, '')
    .replace(/@area\([^)]*\)/g, '')
    .trim();
  console.log(`| \`${file}\` | ${clean} | ${criticalFlag === '1' ? 'yes' : 'no'} | ${p} |`);
}
