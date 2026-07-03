#!/usr/bin/env npx tsx
/**
 * Verifies P0/P1 capability matchers still exist in E2E spec files (static scan).
 * Run: npm run check:test-coverage
 */

import fs from 'fs';
import path from 'path';
import { areas, capabilities } from '../src/tests/test-registry';

const ROOT = path.resolve(__dirname, '..');

function readSpec(relativePath: string): string {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) {
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function capabilitySatisfied(cap: (typeof capabilities)[0]): boolean {
  for (const matcher of cap.matchers) {
    for (const file of matcher.files) {
      const content = readSpec(file);
      if (content && content.includes(matcher.titleIncludes)) {
        return true;
      }
    }
  }
  return false;
}

const missing = capabilities.filter((cap) => !capabilitySatisfied(cap));

const areaCounts = new Map<string, number>();
for (const cap of capabilities) {
  if (capabilitySatisfied(cap)) {
    areaCounts.set(cap.areaId, (areaCounts.get(cap.areaId) ?? 0) + 1);
  }
}

const areaViolations: string[] = [];
for (const area of areas) {
  if (area.priority !== 'P0' && area.priority !== 'P1') continue;
  const count = areaCounts.get(area.id) ?? 0;
  if (count < area.minCriticalCapabilities) {
    areaViolations.push(
      `${area.id} (${area.priority}): ${count}/${area.minCriticalCapabilities} capabilities matched`
    );
  }
}

let failed = false;

if (missing.length > 0) {
  failed = true;
  console.error('Missing capability coverage:');
  for (const cap of missing) {
    console.error(`  - ${cap.id} (${cap.areaId}): ${cap.description}`);
    for (const m of cap.matchers) {
      console.error(`      expect in ${m.files.join(' or ')}: "${m.titleIncludes}"`);
    }
  }
}

if (areaViolations.length > 0) {
  failed = true;
  console.error('\nArea floor violations:');
  for (const v of areaViolations) {
    console.error(`  - ${v}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `check:test-coverage OK — ${capabilities.length} capabilities, ${areas.filter((a) => a.priority === 'P0' || a.priority === 'P1').length} P0/P1 areas meet floors`
);
