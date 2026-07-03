#!/usr/bin/env npx tsx
/**
 * Lists tests from E2E specs via static parse (no Docker).
 * Output lines: file|title|critical (0|1) when LIST_ALL=1; else selected file|title for sampling.
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
  parseTestTags,
  removedSpecFiles,
  defaultPriorityForSpec,
  capabilities,
  type AreaPriority,
} from '../src/tests/test-registry';

const ROOT = path.resolve(__dirname, '..');

const TEST_RE = /(?:^|\n)\s*(?:test|(?:\w+)Test)\(\s*['"`]([^'"`]+)['"`]/g;

function listTestsInFile(
  relativePath: string
): { file: string; title: string; critical: boolean; push: boolean }[] {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) return [];
  const content = fs.readFileSync(full, 'utf8');
  const out: { file: string; title: string; critical: boolean; push: boolean }[] = [];
  let m: RegExpExecArray | null;
  TEST_RE.lastIndex = 0;
  while ((m = TEST_RE.exec(content)) !== null) {
    const title = m[1];
    const tags = parseTestTags(title);
    out.push({ file: relativePath, title, critical: tags.critical, push: tags.push });
  }
  return out;
}

function hashSample(seed: string, testId: string, rate: number): boolean {
  const h = createHash('sha256').update(`${seed}:${testId}`).digest();
  return h[0] % 100 < rate;
}

const specs = process.argv.slice(2).filter((a) => a.endsWith('.e2e.ts'));
const mode = process.env.SAMPLE_MODE ?? '';
const seed = process.env.GITHUB_SHA ?? process.env.SAMPLE_SEED ?? 'local-dev-seed';

if (process.env.LIST_ALL === '1') {
  for (const spec of specs) {
    if (removedSpecFiles.includes(spec)) continue;
    for (const t of listTestsInFile(spec)) {
      console.log(`${t.file}|${t.title}|${t.critical ? '1' : '0'}`);
    }
  }
  process.exit(0);
}

const manifestPath = path.join(ROOT, 'scripts/ci-playwright-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  pushGateMaxTests?: number;
  pushSampleRate: Record<string, number>;
  prSampleRate: Record<string, number>;
};

const rateTable = mode === 'push' ? manifest.pushSampleRate : manifest.prSampleRate;
const defaultRate = rateTable.default ?? 65;

function sampleRateForTest(file: string, title: string): number {
  const tags = parseTestTags(title);
  if (tags.critical) return 100;
  const priority: AreaPriority = tags.areaId
    ? (capabilitiesPriority(tags.areaId) ?? defaultPriorityForSpec(file))
    : defaultPriorityForSpec(file);
  return rateTable[priority] ?? defaultRate;
}

function capabilitiesPriority(areaId: string): AreaPriority | undefined {
  const cap = capabilities.find((c) => c.areaId === areaId);
  return cap?.priority;
}

for (const spec of specs) {
  if (removedSpecFiles.includes(spec)) continue;
  for (const t of listTestsInFile(spec)) {
    const tags = parseTestTags(t.title);
    if (mode === 'push') {
      if (tags.push) {
        console.log(`${t.file}|${t.title}`);
      }
      continue;
    }
    const testId = `${t.file}::${t.title}`;
    const rate = sampleRateForTest(t.file, t.title);
    if (tags.critical || !mode || hashSample(seed, testId, rate)) {
      console.log(`${t.file}|${t.title}`);
    }
  }
}
