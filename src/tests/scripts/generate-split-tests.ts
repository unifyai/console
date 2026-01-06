#!/usr/bin/env tsx
/**
 * Generate Split Test Files
 *
 * Scans browser test files for matrix test exports and generates
 * individual chunk files for parallel execution.
 *
 * Uses vitest to run a discovery script that imports the test files
 * and extracts actual matrix sizes.
 *
 * Usage:
 *   npx tsx src/tests/scripts/generate-split-tests.ts
 *
 * Or via npm script:
 *   npm run test:browser:generate
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

// Configuration
const TEST_ROOT = 'src/tests';
const GENERATED_DIR_NAME = 'generated';
const MATRIX_EXPORT_NAME = 'matrixTests';

interface MatrixTestFile {
  /** Relative path from project root, e.g. 'src/tests/plot/integration/bar.browser.test.tsx' */
  filePath: string;
  /** Directory containing the file, e.g. 'src/tests/plot/integration' */
  directory: string;
  /** Just the filename, e.g. 'bar.browser.test.tsx' */
  fileName: string;
}

/**
 * Recursively scan for browser test files that export matrixTests.
 */
function detectMatrixTestFiles(rootDir: string): MatrixTestFile[] {
  const absoluteRoot = path.join(projectRoot, rootDir);
  const files: MatrixTestFile[] = [];

  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip generated directories and node_modules
        if (entry.name === GENERATED_DIR_NAME || entry.name === 'node_modules') continue;
        scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.browser.test.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Check if file exports matrixTests
        if (
          content.includes(`export const ${MATRIX_EXPORT_NAME}`) ||
          content.includes(`export { ${MATRIX_EXPORT_NAME}`)
        ) {
          const relativePath = path.relative(projectRoot, fullPath);
          const directory = path.dirname(relativePath);
          files.push({
            filePath: relativePath,
            directory,
            fileName: entry.name,
          });
        }
      }
    }
  }

  scanDirectory(absoluteRoot);
  return files;
}

interface ChunkInfo {
  sourceFile: string;
  baseName: string;
  chunkIndex: number;
  totalChunks: number;
  outputPath: string;
}

interface MatrixMetadata {
  totalConfigs: number;
  chunkSize: number;
  numChunks: number;
}

/**
 * Get matrix metadata by running the discover-matrix.ts script.
 * This script mocks vitest and extracts the matrix size from the test file.
 */
function getMatrixMetadata(
  sourceFile: string,
  _exportName: string
): MatrixMetadata | null {
  const absolutePath = path.resolve(projectRoot, sourceFile);
  const discoveryScript = path.join(__dirname, 'discover-matrix.ts');

  try {
    const result = execSync(
      `npx tsx "${discoveryScript}" "${absolutePath}"`,
      {
        cwd: projectRoot,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
        },
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const match = result.match(/__MATRIX_METADATA__(.+?)__END__/);
    if (match) {
      return JSON.parse(match[1]) as MatrixMetadata;
    }

    const errorMatch = result.match(/__MATRIX_ERROR__(.+?)__END__/);
    if (errorMatch) {
      console.log(`        Discovery error: ${errorMatch[1]}`);
    }

    return null;
  } catch (error: any) {
    const output = error?.stdout || error?.stderr || error?.message || '';

    // Try to extract metadata even from error output
    const match = output.match(/__MATRIX_METADATA__(.+?)__END__/);
    if (match) {
      return JSON.parse(match[1]) as MatrixMetadata;
    }

    const errorMatch = output.match(/__MATRIX_ERROR__(.+?)__END__/);
    if (errorMatch) {
      console.log(`        Discovery error: ${errorMatch[1]}`);
    } else {
      const errorMsg = error.message?.split('\n')[0] || 'Unknown error';
      console.log(`        Discovery failed: ${errorMsg}`);
    }

    return null;
  }
}

function main() {
  console.log('🔧 Generating split test files...\n');

  // Detect all matrix test files recursively
  const matrixFiles = detectMatrixTestFiles(TEST_ROOT);
  console.log(`📁 Found ${matrixFiles.length} matrix test files\n`);

  if (matrixFiles.length === 0) {
    console.log('No matrix test files found. Add "export const matrixTests = defineMatrixTests(...)" to enable splitting.');
    return;
  }

  let totalChunksGenerated = 0;

  // Group files by directory
  const filesByDir = new Map<string, MatrixTestFile[]>();
  for (const file of matrixFiles) {
    const existing = filesByDir.get(file.directory) || [];
    existing.push(file);
    filesByDir.set(file.directory, existing);
  }

  // Process each directory
  for (const [directory, files] of Array.from(filesByDir.entries())) {
    const generatedDir = path.join(projectRoot, directory, GENERATED_DIR_NAME);

    // Clean and create generated directory
    if (fs.existsSync(generatedDir)) {
      fs.rmSync(generatedDir, { recursive: true });
    }
    fs.mkdirSync(generatedDir, { recursive: true });

    console.log(`  📂 ${directory}/`);

    for (const file of files) {
      console.log(`     📊 Analyzing ${file.fileName}...`);
      const metadata = getMatrixMetadata(file.filePath, MATRIX_EXPORT_NAME);

      if (!metadata) {
        console.error(`     ❌ Failed to get matrix metadata for ${file.fileName}`);
        console.error(`        Ensure the file exports 'matrixTests' with a valid getMatrix() function`);
        process.exit(1);
      }

      console.log(`        Found: ${metadata.totalConfigs} configs, ${metadata.chunkSize} per chunk`);

      const chunks = generateChunks(file, generatedDir, MATRIX_EXPORT_NAME, metadata.numChunks);
      totalChunksGenerated += chunks.length;

      console.log(`     ✅ ${file.fileName}: ${chunks.length} chunks`);
    }
  }

  console.log(`\n✨ Generated ${totalChunksGenerated} total chunk files`);
  console.log('\nRun with: MATRIX_TEST_SPLIT=true npm run test:browser -- --run');
}

function generateChunks(
  file: MatrixTestFile,
  generatedDir: string,
  exportName: string,
  numChunks: number
): ChunkInfo[] {
  const baseName = path.basename(file.fileName, '.browser.test.tsx');
  const chunks: ChunkInfo[] = [];

  // Calculate relative path from generated dir to the utils directory
  const generatedDirAbs = path.resolve(projectRoot, generatedDir);
  const utilsDir = path.resolve(projectRoot, TEST_ROOT, 'utils');
  const relativeToUtils = path.relative(generatedDirAbs, utilsDir).replace(/\\/g, '/');

  for (let i = 0; i < numChunks; i++) {
    const chunkFileName = `${baseName}.${i}.browser.test.tsx`;
    const outputPath = path.join(generatedDir, chunkFileName);

    const content = generateChunkFileContent({
      baseName,
      exportName,
      chunkIndex: i,
      totalChunks: numChunks,
      relativeToUtils,
    });

    fs.writeFileSync(outputPath, content);
    chunks.push({ sourceFile: file.filePath, baseName, chunkIndex: i, totalChunks: numChunks, outputPath });
  }

  return chunks;
}

function generateChunkFileContent(options: {
  baseName: string;
  exportName: string;
  chunkIndex: number;
  totalChunks: number;
  relativeToUtils: string;
}): string {
  const { baseName, exportName, chunkIndex, totalChunks, relativeToUtils } = options;

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * Source: ${baseName}.browser.test.tsx
 * Chunk: ${chunkIndex + 1} of ${totalChunks}
 *
 * Generated by: src/tests/scripts/generate-split-tests.ts
 * Regenerate with: npm run test:browser:generate
 */

import { ${exportName} } from '../${baseName}.browser.test';
import { runMatrixChunk } from '${relativeToUtils}/matrixTestRunnerBrowser';

// Run chunk ${chunkIndex} of the matrix tests
runMatrixChunk(${exportName}, ${chunkIndex});
`;
}

try {
  main();
} catch (error) {
  console.error('Failed to generate split tests:', error);
  process.exit(1);
}

