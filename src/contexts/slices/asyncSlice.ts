import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";

// The AsyncOperation interface
export interface AsyncOperation {
  id: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  timestamp: number;
  error?: string;
}

// The state portion of the slice
export interface AsyncState {
  operations: Record<string, AsyncOperation>;
}

// The actions portion of the slice
export interface AsyncActions {
  trackOperation: (operationId: string, status: AsyncOperation['status'], error?: string) => void;
  isOperationPending: (operationId: string) => boolean;
  isOperationSuccess: (operationId: string) => boolean;
  isOperationError: (operationId: string) => boolean;
  getOperationError: (operationId: string) => string | undefined;
  cleanupOperation: (operationId: string) => void;
  cleanupStaleOperations: () => void;
}

// The complete slice type
export type AsyncSlice = AsyncState & AsyncActions;

// Create the slice with Zustand's API
export const createAsyncSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  AsyncSlice
> = (set, get) => ({
  // Initialize with empty operations object
  operations: {},
  
  // Track an operation's status
  trackOperation: (operationId, status, error) => set(state => {
    state.operations[operationId] = {
      id: operationId,
      status,
      timestamp: Date.now(),
      ...(error && { error })
    };
  }),
  
  // Check if an operation is pending
  isOperationPending: (operationId) => {
    return get().operations[operationId]?.status === 'pending';
  },
  
  // Check if an operation completed successfully
  isOperationSuccess: (operationId) => {
    return get().operations[operationId]?.status === 'success';
  },
  
  // Check if an operation failed
  isOperationError: (operationId) => {
    return get().operations[operationId]?.status === 'error';
  },
  
  // Get an operation's error message if it failed
  getOperationError: (operationId) => {
    return get().operations[operationId]?.error;
  },
  
  // Remove a specific operation
  cleanupOperation: (operationId) => set(state => {
    delete state.operations[operationId];
  }),
  
  // Clean up operations older than a threshold
  cleanupStaleOperations: () => set(state => {
    const now = Date.now();
    const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
    
    Object.keys(state.operations).forEach(opId => {
      const operation = state.operations[opId];
      if (now - operation.timestamp > STALE_THRESHOLD) {
        delete state.operations[opId];
      }
    });
  })
}); 