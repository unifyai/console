#!/usr/bin/env npx tsx
/**
 * Font Class Compliance Checker
 *
 * Detects non-standard font classes in React/TSX files and enforces
 * the use of standard typography classes defined in globals.css.
 *
 * Run: npx tsx scripts/check-font-classes.ts [files...]
 * Or:  npm run check:fonts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ratchet, reportRatchet, updateBaseline } from './style-baseline';

// ============================================================================
// Configuration
// ============================================================================

// Approved standard classes (from globals.css)
const STANDARD_CLASSES = new Set([
  // Headings
  'text-brand-display',
  'text-brand-heading',
  'text-brand-serif-accent',
  'text-display',
  'text-h1',
  'text-h2',
  'text-h3',
  'text-title',
  'text-h1-bold',
  'text-h2-bold',
  'text-h3-bold',
  'text-title-bold',
  // Body text
  'text-body',
  'text-body-muted',
  'text-body-lg-muted',
  // Labels & captions
  'text-label',
  'text-label-muted',
  'text-caption',
  'text-ink-2',
  'text-doc-title',
  'text-body-dense',
  // Code
  'text-code',
  'text-code-sm',
  // Modifiers
  'text-semibold',
  'text-bold',
  // State colors
  'text-error',
  'text-success',
  'text-warning',
  // Static utility
  'text-base-static',
]);

// Patterns that indicate non-compliant inline font declarations
const NON_COMPLIANT_PATTERNS = [
  // Size + weight combinations that should use standard classes
  /\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\s+font-(?:medium|semibold|bold)\b/g,
  /\bfont-(?:medium|semibold|bold)\s+text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/g,

  // Size + muted combinations
  /\btext-(?:xs|sm|base|lg|xl)\s+text-muted-foreground\b/g,
  /\btext-muted-foreground\s+text-(?:xs|sm|base|lg|xl)\b/g,

  // Size + destructive (should use text-error)
  /\btext-(?:xs|sm|base|lg|xl)\s+text-destructive\b/g,
  /\btext-destructive\s+text-(?:xs|sm|base|lg|xl)\b/g,

  // Monospace + size (should use text-code or text-code-sm)
  /\bfont-mono\s+text-(?:xs|sm|base)\b/g,
  /\btext-(?:xs|sm|base)\s+font-mono\b/g,
];

/**
 * An arbitrary size answers to no scale. The named-scale patterns above never
 * matched it, so it became the way to write any size the ramp did not cover —
 * `text-[9.5px]` through `text-[32px]`, no two surfaces agreeing. Ratcheted
 * rather than hard-failed: see `scripts/style-baseline.ts`.
 */
const ARBITRARY_FONT_SIZE = /\btext-\[[0-9.]+(?:px|rem|em)\]/g;

const ARBITRARY_RULE = 'arbitrary-font-size';

// Standalone patterns - only flag if they're the ONLY font class (likely missing standard)
const STANDALONE_SUSPICIOUS = [
  // Bare sizes without accompanying standard class (needs context check)
  {
    pattern: /\btext-(?:xs|sm)\b/,
    message: 'Consider using text-label, text-body, or text-caption',
  },
  {
    pattern: /\btext-(?:lg|xl|2xl)\b/,
    message: 'Consider using text-h1, text-h2, or text-display',
  },
];

// Files/directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /\.git/,
  // Full runs scan `src/` only; lint-staged hands over whatever is staged.
  // Excluding the tooling keeps the two modes agreeing — and these very
  // scripts carry the forbidden patterns as regex literals.
  /(^|\/)scripts\//,
  /globals\.css$/, // Don't check the definition file itself
  /tailwind\.config/,
  // Canvas code embedded as strings: canvases are styled by the canvas host's
  // own stylesheet (semantic tokens + the vocabulary corpus's utilities), not
  // by console's typography system -- console's standard classes do not exist
  // there, so "fixing" these to text-body-muted would silently unstyle them.
  /simulation\/fixtures\/canvas\.ts$/,
];

// ============================================================================
// Types
// ============================================================================

interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(filePath));
}

function getSuggestion(match: string): string | undefined {
  // Common replacements
  if (/text-sm\s+font-medium|font-medium\s+text-sm/.test(match)) return 'text-title';
  if (/text-lg\s+font-medium|font-medium\s+text-lg/.test(match)) return 'text-h2';
  if (/text-xl\s+font-semibold|font-semibold\s+text-xl/.test(match)) return 'text-h1 text-semibold';
  if (/text-2xl\s+font-bold|font-bold\s+text-2xl/.test(match)) return 'text-display text-bold';
  if (/text-sm\s+text-muted-foreground|text-muted-foreground\s+text-sm/.test(match))
    return 'text-body-muted';
  if (/text-xs\s+text-muted-foreground|text-muted-foreground\s+text-xs/.test(match))
    return 'text-caption';
  if (/text-sm\s+text-destructive|text-destructive\s+text-sm/.test(match))
    return 'text-body text-error';
  if (/font-mono\s+text-xs|text-xs\s+font-mono/.test(match)) return 'text-code-sm';
  if (/font-mono\s+text-sm|text-sm\s+font-mono/.test(match)) return 'text-code';
  return undefined;
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      // Skip lines that don't contain className
      if (!line.includes('className')) return;

      // Check each non-compliant pattern
      NON_COMPLIANT_PATTERNS.forEach((pattern) => {
        // Reset regex state
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(line)) !== null) {
          violations.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            match: match[0],
            message: 'Non-standard font class combination',
            suggestion: getSuggestion(match[0]),
          });
        }
      });
    });
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }

  return violations;
}

/**
 * How many arbitrary font sizes a file carries.
 *
 * Scanned over the whole file rather than per `className` line: class strings
 * are routinely composed across several lines inside `cn(...)`, and a size on
 * a continuation line is the same violation as one on the attribute itself.
 */
function countArbitrarySizes(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  ARBITRARY_FONT_SIZE.lastIndex = 0;
  return (content.match(ARBITRARY_FONT_SIZE) ?? []).length;
}

function getFilesToCheck(args: string[]): string[] {
  if (args.length > 0) {
    // Check specific files passed as arguments (from lint-staged)
    return args.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !shouldSkip(f));
  }

  // Find all TSX/JSX files in src/
  try {
    const result = execSync('find src -name "*.tsx" -o -name "*.jsx"', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    return result
      .trim()
      .split('\n')
      .filter((f) => f && !shouldSkip(f));
  } catch {
    // Fallback for Windows or if find fails
    console.warn('Could not use find command, scanning manually...');
    return walkDir('src').filter((f) => /\.(tsx?|jsx?)$/.test(f) && !shouldSkip(f));
  }
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walkDir(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
  return files;
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const rawArgs = process.argv.slice(2);
  const shouldUpdateBaseline = rawArgs.includes('--update-baseline');
  const args = rawArgs.filter((a) => a !== '--update-baseline');
  const files = getFilesToCheck(args);

  if (files.length === 0) {
    console.log('No files to check.');
    process.exit(0);
  }

  console.log(`\n🔍 Checking ${files.length} file(s) for font class compliance...\n`);

  let allViolations: Violation[] = [];
  const arbitraryCounts = new Map<string, number>();

  for (const file of files) {
    const violations = checkFile(file);
    allViolations = allViolations.concat(violations);
    const arbitrary = countArbitrarySizes(file);
    if (arbitrary > 0) arbitraryCounts.set(file, arbitrary);
  }

  if (shouldUpdateBaseline) {
    updateBaseline(ARBITRARY_RULE, arbitraryCounts, files);
    console.log(`✅ Baseline updated for ${ARBITRARY_RULE}.\n`);
    process.exit(0);
  }

  const arbitraryOk = reportRatchet(
    ARBITRARY_RULE,
    ratchet(ARBITRARY_RULE, arbitraryCounts, files),
    'Use a class from the scale in globals.css. Genuinely new step? Add it there, register it in src/lib/utils.ts, then use it.'
  );

  if (allViolations.length === 0) {
    if (arbitraryOk) {
      console.log('✅ All files comply with font class standards!\n');
      process.exit(0);
    }
    process.exit(1);
  }

  // Report violations
  console.log(`❌ Found ${allViolations.length} violation(s):\n`);

  // Group by file
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const existing = byFile.get(v.file) || [];
    existing.push(v);
    byFile.set(v.file, existing);
  }

  Array.from(byFile.entries()).forEach(([file, violations]) => {
    console.log(`\n📄 ${file}`);
    violations.forEach((v) => {
      console.log(`   Line ${v.line}:${v.column} - "${v.match}"`);
      console.log(`      ⚠️  ${v.message}`);
      if (v.suggestion) {
        console.log(`      💡 Suggestion: ${v.suggestion}`);
      }
    });
  });

  console.log('\n');
  console.log('📚 Standard classes available:');
  console.log('   Headings: text-display, text-h1, text-h2, text-h3, text-title');
  console.log('   Body:     text-body, text-body-muted');
  console.log('   Labels:   text-label, text-label-muted, text-caption');
  console.log('   Code:     text-code, text-code-sm');
  console.log('   Weight:   text-semibold, text-bold');
  console.log('   State:    text-error, text-success, text-warning');
  console.log('\n');

  process.exit(1);
}

main();
