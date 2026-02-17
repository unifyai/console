/**
 * Mock Data Generators for Usage Tests
 *
 * Provides type-aware mock data for testing usage page components and hooks.
 */

import { UsageMetricsResponse, UsageDataPoint, TimeGranularity } from '@/types/usage';
import { UsageActions } from '@/lib/usage/actions';
import { Assistant } from '@/types/assistants/assistant';
import { OrganizationMember } from '@/types/organization';

/**
 * Options for generating mock usage data
 */
export interface MockUsageDataOptions {
  /** Number of data points to generate */
  count: number;
  /** Start date in ISO format */
  startDate: string;
  /** Time granularity */
  granularity: TimeGranularity;
  /** Minimum cost per bucket */
  minCost?: number;
  /** Maximum cost per bucket */
  maxCost?: number;
  /** Whether to include zero-value buckets */
  includeZeros?: boolean;
  /** Percentage of buckets with zero values (0-1) */
  zeroPercentage?: number;
  /** Seed for reproducible random values */
  seed?: number;
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate mock usage metrics response.
 *
 * @param options Generation options
 * @returns Mock metrics response
 */
export function createMockMetricsResponse(options: MockUsageDataOptions): UsageMetricsResponse {
  const {
    count,
    startDate,
    granularity,
    minCost = 0.01,
    maxCost = 10.0,
    includeZeros = false,
    zeroPercentage = 0.1,
    seed = 42,
  } = options;

  const random = seededRandom(seed);
  const response: UsageMetricsResponse = {};
  let current = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const timestamp = formatTimestamp(current, granularity);

    // Determine if this bucket should be zero
    const isZero = includeZeros && random() < zeroPercentage;
    const cost = isZero ? 0 : minCost + random() * (maxCost - minCost);

    response[timestamp] = { sum: cost };

    current = incrementDate(current, granularity);
  }

  return response;
}

/**
 * Generate mock usage data points.
 *
 * @param options Generation options
 * @returns Array of mock data points
 */
export function createMockUsageData(options: MockUsageDataOptions): UsageDataPoint[] {
  const {
    count,
    startDate,
    granularity,
    minCost = 0.01,
    maxCost = 10.0,
    includeZeros = false,
    zeroPercentage = 0.1,
    seed = 42,
  } = options;

  const random = seededRandom(seed);
  const data: UsageDataPoint[] = [];
  let current = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const timestamp = formatTimestamp(current, granularity);

    const isZero = includeZeros && random() < zeroPercentage;
    const billedCost = isZero ? 0 : minCost + random() * (maxCost - minCost);

    data.push({ timestamp, billedCost });

    current = incrementDate(current, granularity);
  }

  return data;
}

/**
 * Format a date as a timestamp string based on granularity.
 */
function formatTimestamp(date: Date, granularity: TimeGranularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  switch (granularity) {
    case 'time_minute':
      return `${year}-${month}-${day}T${hours}:${minutes}:00+00:00`;
    case 'time_hour':
      return `${year}-${month}-${day}T${hours}:00:00+00:00`;
    case 'time_day':
      return `${year}-${month}-${day}`;
    case 'time_month':
      return `${year}-${month}-01`;
    case 'time_year':
      return `${year}-01-01`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Increment a date by one time bucket.
 */
function incrementDate(date: Date, granularity: TimeGranularity): Date {
  const result = new Date(date);

  switch (granularity) {
    case 'time_minute':
      result.setMinutes(result.getMinutes() + 1);
      break;
    case 'time_hour':
      result.setHours(result.getHours() + 1);
      break;
    case 'time_day':
      result.setDate(result.getDate() + 1);
      break;
    case 'time_month':
      result.setMonth(result.getMonth() + 1);
      break;
    case 'time_year':
      result.setFullYear(result.getFullYear() + 1);
      break;
  }

  return result;
}

/**
 * Create a mock assistant for testing.
 */
export function createMockAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    agentId: 'asst_test_123',
    userId: 'user_current', // Default to current user for testing
    firstName: 'Test',
    surname: 'Assistant',
    email: 'test@example.com',
    ...overrides,
  } as Assistant;
}

/**
 * Create a list of mock assistants.
 * By default, all assistants belong to 'user_current'.
 * Use the userId override to assign to different users.
 */
export function createMockAssistantList(
  count: number = 3,
  userId: string = 'user_current'
): Assistant[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAssistant({
      agentId: `asst_${i + 1}`,
      userId,
      firstName: `Assistant${i + 1}`,
      surname: 'Bot',
    })
  );
}

/**
 * Create a list of mock assistants spread across different users.
 * Useful for testing org-wide views where multiple users have assistants.
 */
export function createMockAssistantListMultiUser(userIds: string[]): Assistant[] {
  return userIds.flatMap((userId, userIndex) =>
    createMockAssistantList(1, userId).map((assistant, i) => ({
      ...assistant,
      agentId: `asst_u${userIndex + 1}_${i + 1}`,
      firstName: `${userId}Assistant${i + 1}`,
    }))
  );
}

/**
 * Create a mock organization member.
 */
export function createMockOrgMember(
  overrides: Partial<OrganizationMember> = {}
): OrganizationMember {
  return {
    userId: 'user_test_123',
    name: 'Test User',
    email: 'testuser@example.com',
    roleName: 'Member',
    roleId: 2,
    ...overrides,
  } as OrganizationMember;
}

/**
 * Create a list of mock organization members.
 */
export function createMockOrgMemberList(count: number = 3): OrganizationMember[] {
  return Array.from({ length: count }, (_, i) =>
    createMockOrgMember({
      userId: `user_${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
    })
  );
}

/**
 * Create an empty metrics response.
 */
export function createEmptyMetricsResponse(): UsageMetricsResponse {
  return {};
}

/**
 * Fixture: Sample metrics response for 7 days
 */
export const SAMPLE_WEEK_RESPONSE: UsageMetricsResponse = {
  '2026-01-13': { sum: 1.25 },
  '2026-01-14': { sum: 2.5 },
  '2026-01-15': { sum: 0.75 },
  '2026-01-16': { sum: 3.0 },
  '2026-01-17': { sum: 1.5 },
  '2026-01-18': { sum: 2.25 },
  '2026-01-19': { sum: 1.0 },
};

/**
 * Fixture: Sample metrics response for hourly data
 */
export const SAMPLE_HOURLY_RESPONSE: UsageMetricsResponse = {
  '2026-01-19T00:00:00+00:00': { sum: 0.1 },
  '2026-01-19T01:00:00+00:00': { sum: 0.15 },
  '2026-01-19T02:00:00+00:00': { sum: 0.05 },
  '2026-01-19T03:00:00+00:00': { sum: 0.2 },
  '2026-01-19T04:00:00+00:00': { sum: 0.12 },
};

/**
 * Create mock usage actions for testing.
 * Returns successful responses by default.
 *
 * @param responseData Optional response data to return
 * @returns Mock UsageActions object
 */
export function createMockUsageActions(
  responseData: UsageMetricsResponse = SAMPLE_WEEK_RESPONSE
): UsageActions {
  return {
    setUserSpendingLimit: async () => ({ detail: 'User spending limit set' }),
    setOrgSpendingLimit: async () => ({ detail: 'Org spending limit set' }),
    setMemberSpendingLimit: async () => ({ detail: 'Member spending limit set' }),
    getMetrics: async () => responseData,
    getUserSpendingLimit: async () => ({ type: 'user', limit: 100, label: 'My Limit' }),
    getOrgSpendingLimit: async () => ({ type: 'org', limit: 500, label: 'Org Limit' }),
    getMemberSpendingLimit: async () => ({ type: 'member', limit: 200, label: 'Member Limit' }),
    getAssistantSpendingLimit: async () => ({
      type: 'assistant',
      limit: 50,
      label: 'Assistant Limit',
    }),
  };
}

/**
 * Create mock usage actions that return an error.
 *
 * @param errorDetail Error detail message
 * @returns Mock UsageActions that returns error
 */
export function createMockErrorUsageActions(
  errorDetail: string = 'Something went wrong'
): UsageActions {
  return {
    setUserSpendingLimit: async () => ({ detail: errorDetail }),
    setOrgSpendingLimit: async () => ({ detail: errorDetail }),
    setMemberSpendingLimit: async () => ({ detail: errorDetail }),
    getMetrics: async () => ({ detail: errorDetail }),
    getUserSpendingLimit: async () => ({ detail: errorDetail }),
    getOrgSpendingLimit: async () => ({ detail: errorDetail }),
    getMemberSpendingLimit: async () => ({ detail: errorDetail }),
    getAssistantSpendingLimit: async () => ({ detail: errorDetail }),
  };
}
