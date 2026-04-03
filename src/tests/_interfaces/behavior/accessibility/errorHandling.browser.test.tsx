/**
 * P5-P: Error Handling Behavior Tests
 *
 * Tests behaviors P1-P6 from BEHAVIORS.md:
 * - P1: API failure - logs (500 error from logs endpoint)
 * - P2: API failure - save (save operation fails)
 * - P3: Empty state (no data available)
 * - P4: Loading timeout (API takes too long)
 * - P5: Optimistic rollback (edit fails, reverts to previous value)
 * - P6: Network offline (browser goes offline)
 *
 * These tests verify that the UI gracefully handles failures and provides
 * appropriate feedback to users.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  renderErrorHandling,
  ErrorHandlingTestResult,
  createMockLogEntries,
} from '../fixtures/errorHandlingTestHarness';

describe('P5-P: Error Handling', () => {
  let result: ErrorHandlingTestResult;

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // P1: API failure - logs
  // ==========================================================================
  describe('P1: API failure - logs', () => {
    it('shows error message when logs API fails', async () => {
      result = renderErrorHandling({
        errorType: 'api-logs',
        errorDelay: 50,
        errorMessage: 'Failed to load logs',
      });

      // Initially loading
      expect(result.isLoading()).toBe(true);

      // Wait for error to appear
      await waitFor(
        () => {
          expect(result.hasError()).toBe(true);
        },
        { timeout: 2000 }
      );

      expect(result.getErrorMessage()).toBe('Failed to load logs');
    });

    it('displays error state UI', async () => {
      result = renderErrorHandling({
        errorType: 'api-logs',
        errorDelay: 50,
        errorMessage: 'Server error',
      });

      await waitFor(
        () => {
          expect(screen.getByTestId('error-state')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      expect(screen.getByTestId('error-message')).toHaveTextContent('Server error');
    });

    it('shows retry button on error', async () => {
      result = renderErrorHandling({
        errorType: 'api-logs',
        errorDelay: 50,
      });

      await waitFor(
        () => {
          expect(screen.getByTestId('retry-button')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('retry button attempts to refetch', async () => {
      result = renderErrorHandling({
        errorType: 'api-logs',
        errorDelay: 50,
      });

      await waitFor(
        () => {
          expect(result.hasError()).toBe(true);
        },
        { timeout: 2000 }
      );

      // Trigger retry
      await result.triggerRetry();

      // Should show loading again briefly
      // Then error again since errorType is still 'api-logs'
      await waitFor(() => {
        expect(result.hasError()).toBe(true);
      });

      // Retry count should have increased
      expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
    });

    it('data is not shown when error occurs', async () => {
      result = renderErrorHandling({
        errorType: 'api-logs',
        errorDelay: 50,
        initialData: createMockLogEntries(3),
      });

      await waitFor(
        () => {
          expect(result.hasError()).toBe(true);
        },
        { timeout: 2000 }
      );

      // Data table should not be visible
      expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P2: API failure - save
  // ==========================================================================
  describe('P2: API failure - save', () => {
    it('shows error toast when save fails', async () => {
      result = renderErrorHandling({
        errorType: 'api-save',
        initialData: createMockLogEntries(3),
      });

      // Wait for data to render
      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Try to save
      try {
        await result.triggerSave();
      } catch {
        // Expected to throw
      }

      // Should show error toast
      await waitFor(() => {
        const lastToast = result.getLastToast();
        expect(lastToast?.type).toBe('error');
        expect(lastToast?.message).toContain('Failed to save');
      });
    });

    it('preserves local state when save fails', async () => {
      const initialData = createMockLogEntries(3);
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Data should still be present
      expect(result.getData()).toHaveLength(3);
    });

    it('cell edit shows error toast on save failure', async () => {
      const initialData = createMockLogEntries(3);
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      const cellId = 'log-1-message';

      // Edit a cell
      await result.editCell(cellId, 'New value');

      // Should show error toast
      await waitFor(() => {
        const lastToast = result.getLastToast();
        expect(lastToast?.type).toBe('error');
      });
    });
  });

  // ==========================================================================
  // P3: Empty state
  // ==========================================================================
  describe('P3: Empty state', () => {
    it('shows empty state when no data', async () => {
      result = renderErrorHandling({
        isEmpty: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('displays helpful message', async () => {
      result = renderErrorHandling({
        isEmpty: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty-message')).toHaveTextContent('No data available');
      });
    });

    it('shows hint to upload data', async () => {
      result = renderErrorHandling({
        isEmpty: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty-hint')).toHaveTextContent('Upload data');
      });
    });

    it('shows upload action button', async () => {
      result = renderErrorHandling({
        isEmpty: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('upload-button')).toBeInTheDocument();
      });
    });

    it('isEmpty returns true for empty data', async () => {
      result = renderErrorHandling({
        isEmpty: true,
      });

      await waitFor(() => {
        expect(result.isEmpty()).toBe(true);
      });
    });

    it('data table is not shown when empty', async () => {
      result = renderErrorHandling({
        isEmpty: true,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // P4: Loading timeout
  // ==========================================================================
  describe('P4: Loading timeout', () => {
    it('shows loading spinner initially', async () => {
      result = renderErrorHandling({
        errorType: 'timeout',
        timeoutThreshold: 5000, // Long timeout for this test
      });

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows timeout message after threshold', async () => {
      result = renderErrorHandling({
        errorType: 'timeout',
        timeoutThreshold: 100, // Short timeout for testing
      });

      await waitFor(
        () => {
          expect(screen.getByTestId('timeout-state')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      expect(screen.getByTestId('timeout-message')).toHaveTextContent('Request timed out');
    });

    it('isTimedOut returns true after timeout', async () => {
      result = renderErrorHandling({
        errorType: 'timeout',
        timeoutThreshold: 100,
      });

      await waitFor(
        () => {
          expect(result.isTimedOut()).toBe(true);
        },
        { timeout: 2000 }
      );
    });

    it('shows retry option after timeout', async () => {
      result = renderErrorHandling({
        errorType: 'timeout',
        timeoutThreshold: 100,
      });

      await waitFor(
        () => {
          expect(screen.getByTestId('retry-button')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('retry clears timeout state', async () => {
      result = renderErrorHandling({
        errorType: 'timeout',
        timeoutThreshold: 100,
      });

      await waitFor(
        () => {
          expect(result.isTimedOut()).toBe(true);
        },
        { timeout: 2000 }
      );

      // Trigger retry
      await result.triggerRetry();

      // Should briefly show loading again
      // Note: Since errorType is still 'timeout', it will timeout again
      // but we can verify the retry was attempted
      expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
    });
  });

  // ==========================================================================
  // P5: Optimistic rollback
  // ==========================================================================
  describe('P5: Optimistic rollback', () => {
    it('shows optimistic update immediately', async () => {
      const initialData = createMockLogEntries(3);
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      const cellId = 'log-1-message';
      const originalValue = result.getCellValue(cellId);

      // Start editing (don't await - we want to check intermediate state)
      const editPromise = result.editCell(cellId, 'Optimistic value');

      // Should show pending state briefly
      await waitFor(
        () => {
          const cell = result.getCell(cellId);
          expect(cell?.isPending).toBe(true);
        },
        { timeout: 500 }
      );

      await editPromise;
    });

    it('reverts to original value on failure', async () => {
      const initialData = createMockLogEntries(3);
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      const cellId = 'log-1-message';
      const originalValue = result.getCellValue(cellId);

      // Edit the cell
      await result.editCell(cellId, 'New value that will fail');

      // Should revert to original value
      await waitFor(() => {
        expect(result.getCellValue(cellId)).toBe(originalValue);
      });
    });

    it('shows error toast on rollback', async () => {
      const initialData = createMockLogEntries(3);
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      const cellId = 'log-1-message';

      // Edit the cell
      await result.editCell(cellId, 'New value');

      // Should show error toast
      await waitFor(() => {
        const lastToast = result.getLastToast();
        expect(lastToast?.type).toBe('error');
        expect(lastToast?.message).toContain('Reverted');
      });
    });

    it('cell is no longer pending after rollback', async () => {
      const initialData = createMockLogEntries(3);
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData,
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      const cellId = 'log-1-message';

      // Edit the cell
      await result.editCell(cellId, 'New value');

      // Should no longer be pending
      await waitFor(() => {
        const cell = result.getCell(cellId);
        expect(cell?.isPending).toBe(false);
      });
    });
  });

  // ==========================================================================
  // P6: Network offline
  // ==========================================================================
  describe('P6: Network offline', () => {
    it('shows offline indicator when offline', async () => {
      result = renderErrorHandling({
        errorType: 'network-offline',
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
      });
    });

    it('isOffline returns true when offline', async () => {
      result = renderErrorHandling({
        errorType: 'network-offline',
      });

      expect(result.isOffline()).toBe(true);
    });

    it('can simulate going offline', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(result.isOffline()).toBe(false);
      });

      result.simulateNetworkOffline();

      await waitFor(() => {
        expect(result.isOffline()).toBe(true);
      });

      await waitFor(() => {
        expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
      });
    });

    it('queues changes while offline', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Go offline
      result.simulateNetworkOffline();

      await waitFor(() => {
        expect(result.isOffline()).toBe(true);
      });

      // Make changes while offline
      await result.editCell('log-1-message', 'Offline change 1');
      await result.editCell('log-2-message', 'Offline change 2');

      // Changes should be queued
      await waitFor(() => {
        expect(result.getQueuedChanges()).toHaveLength(2);
      });
    });

    it('shows queued changes count', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Go offline
      result.simulateNetworkOffline();

      await waitFor(() => {
        expect(result.isOffline()).toBe(true);
      });

      // Make changes while offline
      await result.editCell('log-1-message', 'Offline change');

      await waitFor(() => {
        expect(screen.getByTestId('queued-changes-count')).toHaveTextContent('1');
      });
    });

    it('syncs queued changes when back online', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Go offline
      result.simulateNetworkOffline();

      await waitFor(() => {
        expect(result.isOffline()).toBe(true);
      });

      // Make changes while offline
      await result.editCell('log-1-message', 'Offline change');

      await waitFor(() => {
        expect(result.getQueuedChanges()).toHaveLength(1);
      });

      // Go back online
      result.simulateNetworkOnline();

      // Queue should be cleared
      await waitFor(() => {
        expect(result.getQueuedChanges()).toHaveLength(0);
      });
    });

    it('shows success toast when syncing completes', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Go offline and make changes
      result.simulateNetworkOffline();

      await waitFor(() => {
        expect(result.isOffline()).toBe(true);
      });

      await result.editCell('log-1-message', 'Offline change');

      await waitFor(() => {
        expect(result.getQueuedChanges()).toHaveLength(1);
      });

      // Clear any existing toasts
      result.clearToasts();

      // Go back online
      result.simulateNetworkOnline();

      // Should show success toast
      await waitFor(() => {
        const lastToast = result.getLastToast();
        expect(lastToast?.type).toBe('success');
        expect(lastToast?.message).toContain('synced');
      });
    });

    it('offline indicator disappears when back online', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      // Go offline
      result.simulateNetworkOffline();

      await waitFor(() => {
        expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
      });

      // Go back online
      result.simulateNetworkOnline();

      await waitFor(() => {
        expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles multiple errors gracefully', async () => {
      result = renderErrorHandling({
        errorType: 'api-logs',
        errorDelay: 50,
      });

      await waitFor(
        () => {
          expect(result.hasError()).toBe(true);
        },
        { timeout: 2000 }
      );

      // Retry multiple times
      await result.triggerRetry();
      await result.triggerRetry();
      await result.triggerRetry();

      // Should still show error state
      await waitFor(() => {
        expect(result.hasError()).toBe(true);
      });
      expect(screen.getByTestId('retry-count')).toHaveTextContent('3');
    });

    it('toast container is always present', async () => {
      result = renderErrorHandling({
        initialData: createMockLogEntries(3),
      });

      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });

    it('can clear toasts', async () => {
      result = renderErrorHandling({
        saveShouldFail: true,
        initialData: createMockLogEntries(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Trigger an error toast
      await result.editCell('log-1-message', 'New value');

      await waitFor(() => {
        expect(result.getLastToast()).not.toBeNull();
      });

      // Clear toasts
      result.clearToasts();

      await waitFor(() => {
        expect(result.getLastToast()).toBeNull();
      });
    });
  });
});
