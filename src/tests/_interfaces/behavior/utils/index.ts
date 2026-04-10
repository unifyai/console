/**
 * Test Utilities
 *
 * Shared utilities for behavior test harnesses.
 *
 * @example
 * ```tsx
 * import {
 *   TestProviders,
 *   createTestQueryClient,
 *   useStateContainer,
 *   actSync,
 *   actAsync,
 * } from '../utils';
 * ```
 */

// Act wrapper utilities for avoiding "not wrapped in act()" warnings
export {
  actSync,
  actAsync,
  withAct,
  withActAsync,
  waitForCondition,
  flushStateUpdates,
} from './actWrapper';

// Shared provider wrapper for consistent test setup
export { TestProviders, createTestQueryClient, defaultQueryClientConfig } from './testProviders';
export type { TestProvidersProps } from './testProviders';

// State container hook for exposing internal state to tests
export { useStateContainer, createStateContainerBuilder } from './useStateContainer';
