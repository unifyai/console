/**
 * Error Handling Test Harness
 *
 * Tests error handling behaviors (P1-P6):
 * - P1: API failure - logs (500 error from logs endpoint)
 * - P2: API failure - save (save operation fails)
 * - P3: Empty state (no data available)
 * - P4: Loading timeout (API takes too long)
 * - P5: Optimistic rollback (edit fails, reverts to previous value)
 * - P6: Network offline (browser goes offline)
 *
 * This harness simulates various error conditions and verifies the UI
 * handles them gracefully with appropriate feedback to users.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export type ErrorType = 
  | 'api-logs'      // P1: API failure when fetching logs
  | 'api-save'      // P2: API failure when saving
  | 'timeout'       // P4: Loading timeout
  | 'network-offline' // P6: Network offline
  | 'none';         // No error (for empty state P3)

export interface CellData {
  id: string;
  value: string;
  isPending: boolean;
  originalValue?: string;
}

export interface LogEntry {
  id: string;
  entries: Record<string, string>;
  params: Record<string, string>;
}

export interface ErrorHandlingTestOptions {
  /** Which error scenario to simulate */
  errorType?: ErrorType;
  /** Delay before error occurs (ms) - for timeout testing */
  errorDelay?: number;
  /** Timeout threshold (ms) - when to show timeout message */
  timeoutThreshold?: number;
  /** Initial log data */
  initialData?: LogEntry[];
  /** Whether to start with empty data (for P3 empty state) */
  isEmpty?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Whether save operations should fail */
  saveShouldFail?: boolean;
}

export interface ErrorHandlingTestResult {
  container: HTMLElement;
  // State queries
  hasError: () => boolean;
  getErrorMessage: () => string | null;
  isLoading: () => boolean;
  isOffline: () => boolean;
  isEmpty: () => boolean;
  isTimedOut: () => boolean;
  // Actions
  triggerRetry: () => Promise<void>;
  triggerSave: () => Promise<void>;
  simulateNetworkOffline: () => void;
  simulateNetworkOnline: () => void;
  // For optimistic rollback testing
  editCell: (cellId: string, value: string) => Promise<void>;
  getCell: (cellId: string) => CellData | null;
  getCellValue: (cellId: string) => string | null;
  // Toast verification
  getLastToast: () => { type: 'error' | 'success'; message: string } | null;
  clearToasts: () => void;
  // Data queries
  getData: () => LogEntry[];
  getQueuedChanges: () => Array<{ cellId: string; value: string }>;
  // Cleanup
  unmount: () => void;
}

// ============================================================================
// Mock Data
// ============================================================================

export function createMockLogEntries(count: number = 5): LogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i + 1}`,
    entries: {
      message: `Log message ${i + 1}`,
      level: i % 2 === 0 ? 'info' : 'error',
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    },
    params: {
      user: `user-${i + 1}`,
      action: `action-${i + 1}`,
    },
  }));
}

// ============================================================================
// Inner Component
// ============================================================================

interface StateContainer {
  hasError: () => boolean;
  getErrorMessage: () => string | null;
  isLoading: () => boolean;
  isOffline: () => boolean;
  isEmpty: () => boolean;
  isTimedOut: () => boolean;
  triggerRetry: () => Promise<void>;
  triggerSave: () => Promise<void>;
  simulateNetworkOffline: () => void;
  simulateNetworkOnline: () => void;
  editCell: (cellId: string, value: string) => Promise<void>;
  getCell: (cellId: string) => CellData | null;
  getCellValue: (cellId: string) => string | null;
  getLastToast: () => { type: 'error' | 'success'; message: string } | null;
  clearToasts: () => void;
  getData: () => LogEntry[];
  getQueuedChanges: () => Array<{ cellId: string; value: string }>;
}

interface ErrorHandlingInnerProps {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
  options: ErrorHandlingTestOptions;
}

function ErrorHandlingInner({ stateContainerRef, options }: ErrorHandlingInnerProps) {
  const {
    errorType = 'none',
    errorDelay = 0,
    timeoutThreshold = 10000,
    initialData = [],
    isEmpty = false,
    errorMessage = 'An error occurred',
    saveShouldFail = false,
  } = options;

  // State
  const [data, setData] = useState<LogEntry[]>(isEmpty ? [] : initialData);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [isLoading, setIsLoading] = useState(errorType === 'api-logs' || errorType === 'timeout');
  const [hasError, setHasError] = useState(false);
  const [currentErrorMessage, setCurrentErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(errorType === 'network-offline');
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [toasts, setToasts] = useState<Array<{ type: 'error' | 'success'; message: string }>>([]);
  const [queuedChanges, setQueuedChanges] = useState<Array<{ cellId: string; value: string }>>([]);
  const [retryCount, setRetryCount] = useState(0);

  // Initialize cells from data
  useEffect(() => {
    const newCells: Record<string, CellData> = {};
    data.forEach(log => {
      Object.entries(log.entries).forEach(([key, value]) => {
        const cellId = `${log.id}-${key}`;
        newCells[cellId] = {
          id: cellId,
          value,
          isPending: false,
        };
      });
    });
    setCells(newCells);
  }, [data]);

  // Simulate API error after delay
  useEffect(() => {
    if (errorType === 'api-logs') {
      const timer = setTimeout(() => {
        setIsLoading(false);
        setHasError(true);
        setCurrentErrorMessage(errorMessage);
      }, errorDelay);
      return () => clearTimeout(timer);
    }
  }, [errorType, errorDelay, errorMessage]);

  // Simulate timeout
  useEffect(() => {
    if (errorType === 'timeout') {
      const timer = setTimeout(() => {
        setIsTimedOut(true);
        setCurrentErrorMessage('Request timed out. Please try again.');
      }, timeoutThreshold);
      return () => clearTimeout(timer);
    }
  }, [errorType, timeoutThreshold]);

  // Add toast helper
  const addToast = useCallback((type: 'error' | 'success', message: string) => {
    setToasts(prev => [...prev, { type, message }]);
  }, []);

  // Expose state container
  useEffect(() => {
    stateContainerRef.current = {
      hasError: () => hasError,
      getErrorMessage: () => currentErrorMessage,
      isLoading: () => isLoading,
      isOffline: () => isOffline,
      isEmpty: () => data.length === 0 && !isLoading && !hasError,
      isTimedOut: () => isTimedOut,

      triggerRetry: async () => {
        setRetryCount(prev => prev + 1);
        setIsLoading(true);
        setHasError(false);
        setCurrentErrorMessage(null);
        setIsTimedOut(false);

        // Simulate retry
        await new Promise(r => setTimeout(r, 100));

        // If error type is still set, fail again
        if (errorType === 'api-logs') {
          setIsLoading(false);
          setHasError(true);
          setCurrentErrorMessage(errorMessage);
        } else {
          setIsLoading(false);
          // Success - load some data
          if (data.length === 0 && !isEmpty) {
            setData(createMockLogEntries(5));
          }
        }
      },

      triggerSave: async () => {
        // Simulate save operation
        await new Promise(r => setTimeout(r, 100));

        if (saveShouldFail || errorType === 'api-save') {
          addToast('error', 'Failed to save changes');
          throw new Error('Save failed');
        } else {
          addToast('success', 'Changes saved successfully');
        }
      },

      simulateNetworkOffline: () => {
        setIsOffline(true);
      },

      simulateNetworkOnline: () => {
        setIsOffline(false);
        // Process queued changes
        if (queuedChanges.length > 0) {
          // Simulate syncing queued changes
          queuedChanges.forEach(change => {
            setCells(prev => ({
              ...prev,
              [change.cellId]: {
                ...prev[change.cellId],
                isPending: false,
              },
            }));
          });
          setQueuedChanges([]);
          addToast('success', 'Queued changes synced');
        }
      },

      editCell: async (cellId: string, value: string) => {
        const currentCell = cells[cellId];
        if (!currentCell) return;

        // Store original value for rollback
        const originalValue = currentCell.value;

        // Optimistic update
        setCells(prev => ({
          ...prev,
          [cellId]: {
            ...prev[cellId],
            value,
            isPending: true,
            originalValue,
          },
        }));

        // If offline, queue the change
        if (isOffline) {
          setQueuedChanges(prev => [...prev, { cellId, value }]);
          return;
        }

        // Simulate API call
        await new Promise(r => setTimeout(r, 100));

        // Check if save should fail (for optimistic rollback testing)
        if (saveShouldFail || errorType === 'api-save') {
          // Rollback
          setCells(prev => ({
            ...prev,
            [cellId]: {
              ...prev[cellId],
              value: originalValue,
              isPending: false,
              originalValue: undefined,
            },
          }));
          addToast('error', 'Failed to save changes. Reverted to previous value.');
        } else {
          // Success
          setCells(prev => ({
            ...prev,
            [cellId]: {
              ...prev[cellId],
              isPending: false,
              originalValue: undefined,
            },
          }));
        }
      },

      getCell: (cellId: string) => cells[cellId] || null,
      getCellValue: (cellId: string) => cells[cellId]?.value || null,

      getLastToast: () => toasts[toasts.length - 1] || null,
      clearToasts: () => setToasts([]),

      getData: () => data,
      getQueuedChanges: () => queuedChanges,
    };
  }, [
    hasError, currentErrorMessage, isLoading, isOffline, isTimedOut,
    data, cells, toasts, queuedChanges, errorType, errorMessage,
    saveShouldFail, isEmpty, addToast,
  ]);

  // Render UI based on state
  return (
    <div data-testid="error-handling-harness">
      {/* Loading State */}
      {isLoading && !isTimedOut && (
        <div data-testid="loading-state">
          <div data-testid="loading-spinner" className="animate-spin">Loading...</div>
        </div>
      )}

      {/* Timeout State */}
      {isTimedOut && (
        <div data-testid="timeout-state">
          <div data-testid="timeout-message">Request timed out. Please try again.</div>
          <button
            data-testid="retry-button"
            onClick={() => stateContainerRef.current?.triggerRetry()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Error State */}
      {hasError && !isLoading && (
        <div data-testid="error-state">
          <div data-testid="error-message">{currentErrorMessage}</div>
          <button
            data-testid="retry-button"
            onClick={() => stateContainerRef.current?.triggerRetry()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasError && data.length === 0 && (
        <div data-testid="empty-state">
          <div data-testid="empty-message">No data available</div>
          <div data-testid="empty-hint">Upload data to get started</div>
          <button data-testid="upload-button">Upload Data</button>
        </div>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <div data-testid="offline-indicator">
          <span>You are offline</span>
          {queuedChanges.length > 0 && (
            <span data-testid="queued-changes-count">
              {queuedChanges.length} changes queued
            </span>
          )}
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !hasError && data.length > 0 && (
        <div data-testid="data-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Message</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {data.map(log => (
                <tr key={log.id} data-testid={`row-${log.id}`}>
                  <td>{log.id}</td>
                  {Object.entries(log.entries).map(([key, value]) => {
                    const cellId = `${log.id}-${key}`;
                    const cell = cells[cellId];
                    return (
                      <td
                        key={cellId}
                        data-testid={`cell-${cellId}`}
                        data-pending={cell?.isPending ? 'true' : 'false'}
                      >
                        {cell?.value || value}
                        {cell?.isPending && (
                          <span data-testid={`pending-${cellId}`}>Saving...</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast Container */}
      <div data-testid="toast-container">
        {toasts.map((toast, index) => (
          <div
            key={index}
            data-testid={`toast-${toast.type}`}
            className={`toast toast-${toast.type}`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Retry Count (for testing) */}
      <div data-testid="retry-count" style={{ display: 'none' }}>
        {retryCount}
      </div>
    </div>
  );
}

// ============================================================================
// Render Function
// ============================================================================

export function renderErrorHandling(
  options: ErrorHandlingTestOptions = {}
): ErrorHandlingTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };

  // Set default data if not provided and not empty
  const effectiveOptions: ErrorHandlingTestOptions = {
    ...options,
    initialData: options.initialData ?? (options.isEmpty ? [] : createMockLogEntries(5)),
  };

  const { container, unmount } = render(
    <ErrorHandlingInner
      stateContainerRef={stateContainerRef}
      options={effectiveOptions}
    />
  );

  return {
    container,

    // State queries
    hasError: () => stateContainerRef.current?.hasError() ?? false,
    getErrorMessage: () => stateContainerRef.current?.getErrorMessage() ?? null,
    isLoading: () => stateContainerRef.current?.isLoading() ?? false,
    isOffline: () => stateContainerRef.current?.isOffline() ?? false,
    isEmpty: () => stateContainerRef.current?.isEmpty() ?? false,
    isTimedOut: () => stateContainerRef.current?.isTimedOut() ?? false,

    // Actions
    triggerRetry: async () => {
      await act(async () => {
        await stateContainerRef.current?.triggerRetry();
      });
    },
    triggerSave: async () => {
      // Don't wrap in act() - allow the toast state to be set before throwing
      await stateContainerRef.current?.triggerSave();
    },
    simulateNetworkOffline: () => {
      act(() => {
        stateContainerRef.current?.simulateNetworkOffline();
      });
    },
    simulateNetworkOnline: () => {
      act(() => {
        stateContainerRef.current?.simulateNetworkOnline();
      });
    },

    // Cell operations - don't wrap in act() so tests can observe intermediate states
    editCell: async (cellId: string, value: string) => {
      const promise = stateContainerRef.current?.editCell(cellId, value);
      // Wait a tick for React to process the optimistic update
      await new Promise(r => setTimeout(r, 10));
      // Now await the full completion
      await promise;
    },
    getCell: (cellId: string) => stateContainerRef.current?.getCell(cellId) ?? null,
    getCellValue: (cellId: string) => stateContainerRef.current?.getCellValue(cellId) ?? null,

    // Toast operations
    getLastToast: () => stateContainerRef.current?.getLastToast() ?? null,
    clearToasts: () => {
      act(() => {
        stateContainerRef.current?.clearToasts();
      });
    },

    // Data queries
    getData: () => stateContainerRef.current?.getData() ?? [],
    getQueuedChanges: () => stateContainerRef.current?.getQueuedChanges() ?? [],

    unmount,
  };
}

// Types are already exported above via `export interface`

