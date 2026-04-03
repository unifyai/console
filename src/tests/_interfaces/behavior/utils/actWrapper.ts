/**
 * Act Wrapper Utilities
 *
 * Utilities to properly wrap state updates in React's act() function
 * to avoid "not wrapped in act(...)" warnings in tests.
 *
 * These are particularly useful when:
 * - Calling store actions from test code
 * - Triggering async state updates
 * - Working with Zustand store updates that happen outside React's control
 *
 * Usage:
 *   import { actSync, actAsync, withAct } from '../utils/actWrapper';
 *
 *   // Sync operations
 *   actSync(() => store.toggleEditMode());
 *
 *   // Async operations
 *   await actAsync(async () => {
 *     await store.save();
 *   });
 *
 *   // Wrap a function to always use act
 *   const wrappedToggle = withAct(store.toggleEditMode);
 *   wrappedToggle();
 */
import { act } from '@testing-library/react';

/**
 * Wraps a synchronous callback in act() and returns the result.
 * Use this for immediate state updates that don't involve promises.
 *
 * @example
 * const result = actSync(() => store.getState());
 */
export function actSync<T>(callback: () => T): T {
  let result: T;
  act(() => {
    result = callback();
  });
  return result!;
}

/**
 * Wraps an asynchronous callback in act() and returns a promise.
 * Use this for async operations like API calls or setTimeout-based updates.
 *
 * @example
 * await actAsync(async () => {
 *   await store.saveChanges();
 * });
 */
export async function actAsync<T>(callback: () => Promise<T>): Promise<T> {
  let result: T;
  await act(async () => {
    result = await callback();
  });
  return result!;
}

/**
 * Creates a wrapped version of a function that always executes within act().
 * Useful for creating test helpers that need to trigger state updates.
 *
 * @example
 * const wrappedToggle = withAct(store.toggleEditMode);
 * wrappedToggle(); // Automatically wrapped in act()
 */
export function withAct<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    let result: TReturn;
    act(() => {
      result = fn(...args);
    });
    return result!;
  };
}

/**
 * Creates a wrapped version of an async function that always executes within act().
 *
 * @example
 * const wrappedSave = withActAsync(store.save);
 * await wrappedSave(); // Automatically wrapped in act()
 */
export function withActAsync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    let result: TReturn;
    await act(async () => {
      result = await fn(...args);
    });
    return result!;
  };
}

/**
 * Waits for a condition to be true, checking periodically within act().
 * Useful for waiting for async state updates to complete.
 *
 * @example
 * await waitForCondition(() => store.getState().isLoaded, 5000);
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }

    await actAsync(async () => {
      await new Promise((resolve) => setTimeout(resolve, interval));
    });
  }
}

/**
 * Flushes pending state updates by waiting a microtask within act().
 * Useful after triggering state updates to ensure React has processed them.
 *
 * @example
 * store.dispatch(action);
 * await flushStateUpdates();
 * expect(store.getState().value).toBe(expected);
 */
export async function flushStateUpdates(): Promise<void> {
  await actAsync(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
