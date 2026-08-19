/**
 * Ratchet for the style rules that carry existing debt.
 *
 * The token scale reaches the whole app, but arbitrary Tailwind values —
 * `text-[13px]`, `rounded-[9px]` — were never checked, so a few hundred
 * accumulated in surfaces the ramp did not cover. Failing on all of them would
 * mean either a sweep too large to review or a rule nobody turns on.
 *
 * Instead the baseline records what each file already carries. A file may
 * never exceed its recorded count, so no new drift lands; bringing one down
 * shows up as an improvement to fold back in with `--update-baseline`. Files
 * absent from the baseline are held at zero, which is every file written from
 * here on.
 */

import * as fs from 'fs';
import * as path from 'path';

export const BASELINE_PATH = path.join('scripts', 'style-baseline.json');

/** Rule id → checked file → the count that file is allowed to carry. */
export type Baseline = Record<string, Record<string, number>>;

export interface RatchetEntry {
  file: string;
  allowed: number;
  actual: number;
}

export interface RatchetResult {
  /** Files that exceed their allowance. These fail the check. */
  regressions: RatchetEntry[];
  /** Files that came in under. These pass, and invite a baseline refresh. */
  improvements: RatchetEntry[];
}

export function loadBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_PATH)) return {};
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
}

/**
 * Baseline keys are repo-relative. A full run reaches the checkers with
 * relative paths, but lint-staged hands them absolute ones — left as-is, every
 * staged file would miss its allowance and read as a fresh violation.
 */
function toRepoRelative(file: string): string {
  return path.relative(process.cwd(), path.resolve(file));
}

/**
 * Compare this run's counts against the allowances.
 *
 * Only `checkedFiles` are considered, so a lint-staged run over three files
 * cannot be misread as the rest of the repo having been fixed.
 */
export function ratchet(
  rule: string,
  counts: Map<string, number>,
  checkedFiles: string[],
  baseline: Baseline = loadBaseline()
): RatchetResult {
  const allowances = baseline[rule] ?? {};
  const regressions: RatchetEntry[] = [];
  const improvements: RatchetEntry[] = [];

  for (const file of checkedFiles) {
    const key = toRepoRelative(file);
    const allowed = allowances[key] ?? 0;
    const actual = counts.get(file) ?? 0;
    if (actual > allowed) regressions.push({ file: key, allowed, actual });
    else if (actual < allowed) improvements.push({ file: key, allowed, actual });
  }

  return { regressions, improvements };
}

/** Fold this run's counts into the baseline for the files it covered. */
export function updateBaseline(
  rule: string,
  counts: Map<string, number>,
  checkedFiles: string[]
): void {
  const baseline = loadBaseline();
  const allowances = { ...(baseline[rule] ?? {}) };

  for (const file of checkedFiles) {
    const key = toRepoRelative(file);
    const actual = counts.get(file) ?? 0;
    if (actual > 0) allowances[key] = actual;
    else delete allowances[key];
  }

  baseline[rule] = Object.fromEntries(
    Object.entries(allowances).sort(([a], [b]) => (a < b ? -1 : 1))
  );
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}

export function reportRatchet(rule: string, result: RatchetResult, guidance: string): boolean {
  if (result.improvements.length > 0) {
    const total = result.improvements.reduce((n, e) => n + (e.allowed - e.actual), 0);
    console.log(
      `\n✨ ${rule}: ${total} fewer than the baseline across ${result.improvements.length} file(s).`
    );
    console.log(`   Lock it in with: npm run check:styles:baseline\n`);
  }

  if (result.regressions.length === 0) return true;

  const total = result.regressions.reduce((n, e) => n + (e.actual - e.allowed), 0);
  console.log(`\n❌ ${rule}: ${total} new violation(s) beyond the baseline:\n`);
  for (const entry of result.regressions) {
    const suffix = entry.allowed > 0 ? ` (baseline allows ${entry.allowed})` : '';
    console.log(`   ${entry.file} — ${entry.actual}${suffix}`);
  }
  console.log(`\n   ${guidance}\n`);
  return false;
}
