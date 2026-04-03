/**
 * Shared helpers for Table View API tests
 *
 * Contains:
 * - API request helpers
 * - Test project setup/teardown
 * - Type definitions
 */

// =============================================================================
// Environment Configuration
// =============================================================================

export const VITE_TEST_API_KEY = process.env.VITE_TEST_API_KEY ?? 'test-api-key';
export const VITE_TEST_API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3000';
export const TABLE_TEST_API_REAL = process.env.VITE_TEST_API_REAL === 'true';

export const TEST_PROJECT = 'table-view-test-project';

// =============================================================================
// Shard-aware Test Project Name
// =============================================================================

function getShardTestProjectName(): string {
  const shardSpec = process.env.MATRIX_SHARD;
  if (shardSpec) {
    const [shardIndex] = shardSpec.split('/').map(Number);
    if (!isNaN(shardIndex)) {
      return `${TEST_PROJECT}-shard-${shardIndex}`;
    }
  }
  return TEST_PROJECT;
}

export const SHARD_TEST_PROJECT = getShardTestProjectName();

// =============================================================================
// Test Project Setup/Teardown
// =============================================================================

/**
 * Create the test project for real API tests.
 */
export async function createTestProject(): Promise<void> {
  const projectName = SHARD_TEST_PROJECT;
  try {
    const response = await fetch(`${VITE_TEST_API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apiKey: VITE_TEST_API_KEY,
      },
      body: JSON.stringify({ name: projectName }),
    });

    if (response.ok) {
      console.log(`[Table API Tests] Created test project: ${projectName}`);
    } else if (response.status === 400) {
      console.log(`[Table API Tests] Test project already exists: ${projectName}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Table API Tests] Failed to create test project: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Table API Tests] Error creating test project:`, error);
  }
}

/**
 * Delete the test project after real API tests.
 */
export async function deleteTestProject(): Promise<void> {
  const projectName = SHARD_TEST_PROJECT;
  try {
    const response = await fetch(
      `${VITE_TEST_API_URL}/api/projects/${encodeURIComponent(projectName)}`,
      {
        method: 'DELETE',
        headers: {
          apiKey: VITE_TEST_API_KEY,
        },
      }
    );

    if (response.ok) {
      console.log(`[Table API Tests] Deleted test project: ${projectName}`);
    } else if (response.status === 404) {
      console.log(`[Table API Tests] Test project not found: ${projectName}`);
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn(`[Table API Tests] Failed to delete test project: ${response.status}`, data);
    }
  } catch (error) {
    console.warn(`[Table API Tests] Error deleting test project:`, error);
  }
}

/**
 * Seed the test project with mock logs.
 */
export async function seedTestProjectData(count: number = 100): Promise<void> {
  const projectName = SHARD_TEST_PROJECT;
  const BATCH_SIZE = 250;
  let totalSeeded = 0;

  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, count - offset);

    const entries = Array.from({ length: batchCount }, (_, i) => {
      const idx = offset + i;
      return {
        id: idx + 1,
        name: `Item ${idx + 1}`,
        status: idx % 3 === 0 ? 'active' : idx % 3 === 1 ? 'pending' : 'completed',
        value: Math.round(Math.random() * 1000) / 10,
        category: `category_${idx % 5}`,
        priority: idx % 4 === 0 ? 'high' : idx % 4 === 1 ? 'medium' : 'low',
      };
    });

    const response = await fetch(`${VITE_TEST_API_URL}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apiKey: VITE_TEST_API_KEY,
      },
      body: JSON.stringify({
        projectName: projectName,
        entries,
      }),
    });

    if (response.ok) {
      totalSeeded += batchCount;
      console.log(
        `[Table API Tests] Seeded batch ${Math.floor(offset / BATCH_SIZE) + 1}/${Math.ceil(count / BATCH_SIZE)} (${batchCount} logs)`
      );
    } else {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to seed batch at offset ${offset}: ${response.status} - ${JSON.stringify(data)}`
      );
    }
  }

  console.log(`[Table API Tests] Completed seeding ${totalSeeded} logs to project: ${projectName}`);
}

// =============================================================================
// API Request Helpers
// =============================================================================

/**
 * Get the base URL for API requests
 */
export function getApiBaseUrl(): string {
  return TABLE_TEST_API_REAL ? VITE_TEST_API_URL : '';
}

/**
 * Create a POST request to /api/table/create
 */
export async function createTableViewRequest(
  body: Record<string, unknown>,
  options: { apiKey?: string | null; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.apiKey !== null) {
    headers.Authorization = `Bearer ${options.apiKey ?? VITE_TEST_API_KEY}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/table/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

/**
 * Create a GET request to /api/table/data/[token]
 */
export async function getTableViewDataRequest(token: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/table/data/${token}`);

  return {
    status: response.status,
    data: await response.json(),
  };
}
