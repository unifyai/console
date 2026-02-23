// Define operation ID template strings
export const OPERATIONS = {
  // Tab operations
  FETCH_TAB: (tabId: string) => `fetch_tab_${tabId}`,
  UPDATE_TAB: (tabId: string) => `update_tab_${tabId}`,

  // Tile operations
  FETCH_TILE: (tileId: string) => `fetch_tile_${tileId}`,
  UPDATE_TILE: (tileId: string) => `update_tile_${tileId}`,

  // Logs operations
  FETCH_LOGS: (tileId: string) => `fetch_logs_${tileId}`,

  // Initial data loading
  INITIAL_LOAD: (timestamp: number) => `initial_load_${timestamp}`,

  // Store update operation
  STORE_UPDATE: (timestamp: number) => `store_update_${timestamp}`,

  // Generic operations
  GENERIC: (id: string) => `generic_${id}`,
};

// Wrap an async function with operation tracking
export async function trackAsyncOperation<T>(
  store: any,
  operationId: string,
  asyncFn: () => Promise<T>
): Promise<T> {
  try {
    // Mark operation as pending
    store.trackOperation(operationId, 'pending');

    // Execute the async function
    const result = await asyncFn();

    // Mark operation as successful
    store.trackOperation(operationId, 'success');

    return result;
  } catch (error) {
    // Mark operation as failed
    store.trackOperation(
      operationId,
      'error',
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}

// Helper to get operation state for a component
export function getOperationState(store: any, operationId: string) {
  return {
    isPending: store.isOperationPending(operationId),
    isSuccess: store.isOperationSuccess(operationId),
    isError: store.isOperationError(operationId),
    error: store.getOperationError(operationId),
  };
}
