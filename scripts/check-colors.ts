#!/usr/bin/env npx tsx
/**
 * Color Compliance Checker
 *
 * Dynamically reads CSS variables from the brand token stylesheets and
 * globals.css, and enforces the use of CSS variables instead of raw hex colors.
 *
 * Run: npx tsx scripts/check-colors.ts [files...]
 * Or:  npm run check:colors
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ratchet, reportRatchet, updateBaseline } from './style-baseline';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Every stylesheet that defines colour tokens, in cascade order.
 *
 * `tokens.css` holds the brand primitives (the literal hex values), and
 * `semantic.css` the theme mapping built on them; both are shared via the
 * `branding` submodule so the Canvas runtime host resolves identical values on
 * its own origin. `globals.css` keeps console's remaining app-level styles.
 *
 * A missing file is skipped rather than fatal: the branding submodule is not
 * always checked out (fresh clones, some CI lanes), and this checker must
 * still enforce the no-raw-hex rule when it is absent.
 */
const COLOR_SOURCE_PATHS = [
  'branding/packages/brand/tokens/tokens.css',
  'branding/packages/brand/tokens/semantic.css',
  'src/styles/globals.css',
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
  // Don't check the token definition files themselves — raw hex is their job.
  /globals\.css$/,
  /tokens\/(tokens|semantic|theme-v4)\.css$/,
  /tailwind\.config/,
  // OG image routes need raw colors for image generation (no CSS support)
  /\/api\/og\//,
  // Email templates may need inline colors
  /emailTemplates/,
  // Design tokens file defines colors for export (mirrors globals.css)
  /design-tokens\.ts$/,
  // Copied landing-page unity renderer keeps exact hex inputs for pixel parity.
  /components\/Brand\/(RotatingBot|TeammateCreature)\.tsx$/,
  // Test fixtures may use arbitrary colors for visualization
  /fixtures\//,
  /\.test\./,
  /\.spec\./,
  // Demo recordings generate SVG content with inline colors
  /src\/demos\//,
];

/**
 * Radii are tokens too — `--radius` and its `rounded-sm/md/lg/xl/control/pill`
 * classes — and an arbitrary one bypasses them the same way an arbitrary
 * colour would. Most are a token spelled out by hand: `rounded-[10px]` is
 * exactly `rounded-lg`. Ratcheted, per `scripts/style-baseline.ts`.
 */
const ARBITRARY_RADIUS = /\brounded(?:-[a-z]+)?-\[[0-9.]+(?:px|rem|em)\]/g;

const ARBITRARY_RADIUS_RULE = 'arbitrary-radius';

// Patterns that are acceptable (non-color hex codes)
const ALLOWED_HEX_PATTERNS = [
  // SVG data URIs
  /url\([^)]*#[0-9a-fA-F]+/,
  // Scroll IDs or anchors
  /href=["']#/,
  // Object keys or IDs that happen to be hex-like
  /id=["'][^"']*#/,
  // Tailwind arbitrary values that use CSS variables
  /\[var\(--[^\]]+\)\]/,
  // Color channel values like rgb()/hsl()
  /rgba?\([^)]+\)/,
  /hsla?\([^)]+\)/,
];

// ============================================================================
// Types
// ============================================================================

interface CSSVariable {
  name: string;
  value: string;
  normalizedValue: string;
}

interface Violation {
  file: string;
  line: number;
  column: number;
  hexColor: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Parse CSS Variables from the colour source stylesheets
// ============================================================================

function parseColorVariables(): Map<string, CSSVariable> {
  const variables = new Map<string, CSSVariable>();
  let found = 0;

  for (const relPath of COLOR_SOURCE_PATHS) {
    const cssPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(cssPath)) continue;
    found += 1;

    const content = fs.readFileSync(cssPath, 'utf-8');

    // Match CSS variable definitions: --variable-name: #hexvalue;
    const varRegex = /--([a-zA-Z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(content)) !== null) {
      const name = match[1];
      const value = match[2];
      const normalizedValue = normalizeHex(value);

      // First source in cascade order wins, so a raw hex is attributed to the
      // primitive that defines it rather than to a theme alias of the same value.
      if (variables.has(normalizedValue)) continue;

      variables.set(normalizedValue, {
        name: `--${name}`,
        value,
        normalizedValue,
      });
    }
  }

  if (found === 0) {
    console.error(`Error: none of the colour sources exist: ${COLOR_SOURCE_PATHS.join(', ')}`);
    process.exit(1);
  }

  return variables;
}

function normalizeHex(hex: string): string {
  // Remove # and convert to lowercase
  let normalized = hex.replace('#', '').toLowerCase();

  // Expand 3-char hex to 6-char
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((c) => c + c)
      .join('');
  }

  // Remove alpha channel if present (8-char hex)
  if (normalized.length === 8) {
    normalized = normalized.slice(0, 6);
  }

  return normalized;
}

// ============================================================================
// Helpers
// ============================================================================

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(filePath));
}

function isAllowedContext(line: string, hexMatch: string): boolean {
  // Check if the hex is in an allowed pattern context
  return ALLOWED_HEX_PATTERNS.some((p) => p.test(line));
}

function checkFile(filePath: string, cssVariables: Map<string, CSSVariable>): Violation[] {
  const violations: Violation[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Regex to find hex colors
    const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

    lines.forEach((line, lineIndex) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

      // Skip if line matches allowed patterns
      if (isAllowedContext(line, '')) return;

      // Reset regex state
      hexRegex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = hexRegex.exec(line)) !== null) {
        const fullMatch = match[0];
        const hexValue = match[1];

        // Skip if it's a short non-color hex (might be an ID or something else)
        if (hexValue.length < 3) continue;

        // Skip if it looks like it's in a data URI or other allowed context
        const contextStart = Math.max(0, match.index - 50);
        const context = line.slice(contextStart, match.index + fullMatch.length + 10);
        if (isAllowedContext(context, fullMatch)) continue;

        // Check if this hex has a corresponding CSS variable
        const normalized = normalizeHex(fullMatch);
        const cssVar = cssVariables.get(normalized);

        violations.push({
          file: filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          hexColor: fullMatch,
          message: 'Raw hex color used instead of CSS variable',
          suggestion: cssVar
            ? `Use var(${cssVar.name}) or Tailwind: text-[var(${cssVar.name})] / bg-[var(${cssVar.name})]`
            : 'Consider adding this color to @unity/brand tokens as a CSS variable',
        });
      }
    });
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }

  return violations;
}

/** How many arbitrary border radii a file carries. */
function countArbitraryRadii(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  ARBITRARY_RADIUS.lastIndex = 0;
  return (content.match(ARBITRARY_RADIUS) ?? []).length;
}

function getFilesToCheck(args: string[]): string[] {
  if (args.length > 0) {
    // Check specific files passed as arguments (from lint-staged)
    return args.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !shouldSkip(f));
  }

  // Find all TSX/JSX files in src/
  try {
    const result = execSync(
      'find src -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js"',
      {
        encoding: 'utf-8',
        cwd: process.cwd(),
      }
    );
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

  // Parse CSS variables first
  console.log('\n📋 Reading CSS variables from brand tokens + globals.css...');
  const cssVariables = parseColorVariables();
  console.log(`   Found ${cssVariables.size} color variables\n`);

  const files = getFilesToCheck(args);

  if (files.length === 0) {
    console.log('No files to check.');
    process.exit(0);
  }

  console.log(`🔍 Checking ${files.length} file(s) for color compliance...\n`);

  let allViolations: Violation[] = [];
  const radiusCounts = new Map<string, number>();

  for (const file of files) {
    const violations = checkFile(file, cssVariables);
    allViolations = allViolations.concat(violations);
    const radii = countArbitraryRadii(file);
    if (radii > 0) radiusCounts.set(file, radii);
  }

  if (shouldUpdateBaseline) {
    updateBaseline(ARBITRARY_RADIUS_RULE, radiusCounts, files);
    console.log(`✅ Baseline updated for ${ARBITRARY_RADIUS_RULE}.\n`);
    process.exit(0);
  }

  const radiusOk = reportRatchet(
    ARBITRARY_RADIUS_RULE,
    ratchet(ARBITRARY_RADIUS_RULE, radiusCounts, files),
    'Use rounded-sm/md/lg/xl, rounded-control or rounded-pill. Genuinely new radius? Add the token to the brand tokens first.'
  );

  if (allViolations.length === 0) {
    if (radiusOk) {
      console.log('✅ All files comply with color standards!\n');
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
      console.log(`   Line ${v.line}:${v.column} - "${v.hexColor}"`);
      console.log(`      ⚠️  ${v.message}`);
      if (v.suggestion) {
        console.log(`      💡 ${v.suggestion}`);
      }
    });
  });

  console.log('\n');
  console.log('📚 Available CSS color variables (from brand tokens + globals.css):');
  const varList = Array.from(cssVariables.values()).slice(0, 15);
  for (const v of varList) {
    console.log(`   ${v.name}: ${v.value}`);
  }
  if (cssVariables.size > 15) {
    console.log(`   ... and ${cssVariables.size - 15} more`);
  }
  console.log('\n');

  process.exit(1);
}

main();
