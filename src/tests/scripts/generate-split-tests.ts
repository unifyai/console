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
 * Get matrix metadata by running vitest with a discovery test.
 */
function getMatrixMetadata(
  sourceFile: string,
  exportName: string
): MatrixMetadata | null {
  // Calculate relative import path from src/tests to the source file
  const sourceDir = path.dirname(sourceFile);
  const relativeImport = './' + path.relative('src/tests', sourceFile).replace(/\\/g, '/').replace('.tsx', '');

  // Create a temporary discovery test file in src/tests (so it matches vitest include pattern)
  const discoveryScript = `
import { describe, it, expect } from 'vitest';
import { ${exportName} } from '${relativeImport}';

describe('Matrix Discovery', () => {
  it('outputs metadata', () => {
    const matrix = ${exportName}.getMatrix();
    const metadata = {
      totalConfigs: matrix.length,
      chunkSize: ${exportName}.chunkSize || 10,
      numChunks: Math.ceil(matrix.length / (${exportName}.chunkSize || 10)),
    };
    console.log('__MATRIX_METADATA__' + JSON.stringify(metadata) + '__END__');
    expect(true).toBe(true);
  });
});
`;

  const tempPath = path.join(projectRoot, 'src/tests/.temp-discover.node.test.ts');

  try {
    fs.writeFileSync(tempPath, discoveryScript);

    // Run vitest with the discovery test (suppress most output, just capture stdout)
    const result = execSync(
      `npm run test:node -- --run ${tempPath} 2>&1`,
      {
        cwd: projectRoot,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
        },
        timeout: 60000,
      }
    );

    // Extract metadata from output
    const match = result.match(/__MATRIX_METADATA__(.+?)__END__/);
    if (match) {
      return JSON.parse(match[1]) as MatrixMetadata;
    }

    return null;
  } catch (error: any) {
    // Try to extract metadata even from failed output (discovery test may fail due to browser deps)
    const output = error?.stdout || error?.message || '';
    const match = output.match(/__MATRIX_METADATA__(.+?)__END__/);
    if (match) {
      return JSON.parse(match[1]) as MatrixMetadata;
    }
    return null;
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function main() {
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
      const absolutePath = path.join(projectRoot, file.filePath);

      console.log(`     📊 Analyzing ${file.fileName}...`);
      const metadata = getMatrixMetadata(file.filePath, MATRIX_EXPORT_NAME);

      let numChunks: number;
      let metadataSource: string;

      if (metadata) {
        numChunks = metadata.numChunks;
        metadataSource = `${metadata.totalConfigs} configs`;
        console.log(`        Found: ${metadata.totalConfigs} configs, ${metadata.chunkSize} per chunk`);
      } else {
        numChunks = estimateChunkCount(absolutePath);
        metadataSource = 'estimated';
        console.log(`        Using heuristic estimation`);
      }

      const chunks = generateChunks(file, generatedDir, MATRIX_EXPORT_NAME, numChunks);
      totalChunksGenerated += chunks.length;

      console.log(`     ✅ ${file.fileName}: ${chunks.length} chunks (${metadataSource})`);
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

function estimateChunkCount(sourceFile: string): number {
  const content = fs.readFileSync(sourceFile, 'utf-8');

  const chunkSizeMatch = content.match(/chunkSize:\s*(\d+)/);
  const chunkSize = chunkSizeMatch ? parseInt(chunkSizeMatch[1], 10) : 10;

  const fileName = path.basename(sourceFile);
  let baseMatrixSize = 100;

  if (fileName.includes('bar')) baseMatrixSize = 400;
  else if (fileName.includes('scatter') || fileName.includes('line')) baseMatrixSize = 300;
  else if (fileName.includes('histogram')) baseMatrixSize = 200;

  const sampleRate = parseInt(process.env.PLOT_TEST_SAMPLE_RATE || '100', 10);
  const estimatedConfigs = Math.ceil((baseMatrixSize * sampleRate) / 100);

  return Math.max(1, Math.ceil(estimatedConfigs / chunkSize));
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
import { runMatrixChunk } from '${relativeToUtils}/matrixTestRunner';

// Run chunk ${chunkIndex} of the matrix tests
runMatrixChunk(${exportName}, ${chunkIndex});
`;
}

main().catch((error) => {
  console.error('Failed to generate split tests:', error);
  process.exit(1);
});

