import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { v4 as uuidv4 } from 'uuid';
import { AsyncOperation } from '../../slices/asyncSlice';
import { useProjectMeta } from './useProjectMeta';

/**
 * Interface for project operations-related actions
 */
export interface ProjectOperationsActions {
  /**
   * Track an operation for this project
   * @param operationName The name of the operation (e.g., 'fetchInterfaces', 'saveProject')
   * @param options Optional parameters for the operation
   * @returns The unique operation ID that can be used to check status later
   */
  trackOperation: (operationName: string, options?: {
    key?: string;
    meta?: Record<string, any>;
  }) => string;
  
  /**
   * Mark an operation as successful
   * @param operationId The operation ID to mark as success
   */
  markOperationSuccess: (operationId: string) => void;
  
  /**
   * Mark an operation as failed
   * @param operationId The operation ID to mark as error
   * @param error The error message
   */
  markOperationError: (operationId: string, error: string) => void;
  
  /**
   * Clean up an operation by ID
   * @param operationId The operation ID to clean up
   */
  cleanupOperation: (operationId: string) => void;
  
  /**
   * Clean up stale operations for this project
   */
  cleanupStaleOperations: () => void;
  
  /**
   * Check if an operation is in progress
   * @param operationName The name of the operation
   * @param key Optional specific key for the operation
   * @returns True if the operation is pending, false otherwise
   */
  isOperationPending: (operationName: string, key?: string) => boolean;
  
  /**
   * Check if an operation was successful
   * @param operationName The name of the operation
   * @param key Optional specific key for the operation
   * @returns True if the operation succeeded, false otherwise
   */
  isOperationSuccess: (operationName: string, key?: string) => boolean;
  
  /**
   * Check if an operation had an error
   * @param operationName The name of the operation
   * @param key Optional specific key for the operation
   * @returns True if the operation had an error, false otherwise
   */
  isOperationError: (operationName: string, key?: string) => boolean;
  
  /**
   * Get the error from a failed operation
   * @param operationName The name of the operation
   * @param key Optional specific key for the operation
   * @returns The operation error or undefined if not available
   */
  getOperationError: (operationName: string, key?: string) => string | undefined;
  
  /**
   * Get the operation ID for a given operation name and key
   * @param operationName The name of the operation
   * @param key Optional specific key for the operation
   * @returns The operation ID
   */
  getOperationId: (operationName: string, key?: string) => string;
}

/**
 * Custom hook to access and manage project operations
 * @param projectName The name of the project to access
 * @returns Object containing project operations state and actions
 */
export function useProjectOperations(projectName: string | null) {
  // Use the meta hook to get common project info
  const { projectId } = useProjectMeta(projectName);
  
  // Access the async operations from the store
  const storeTrackOperation = useStoreContext(state => state.trackOperation);
  const storeIsOperationPending = useStoreContext(state => state.isOperationPending);
  const storeIsOperationSuccess = useStoreContext(state => state.isOperationSuccess);
  const storeIsOperationError = useStoreContext(state => state.isOperationError);
  const storeGetOperationError = useStoreContext(state => state.getOperationError);
  const storeCleanupOperation = useStoreContext(state => state.cleanupOperation);
  const storeCleanupStaleOperations = useStoreContext(state => state.cleanupStaleOperations);
  
  // Access all operations from the store
  const allOperations = useStoreContext(state => state.operations);
  
  // Define a prefix for project-specific operations to avoid ID collisions
  const operationPrefix = useMemo(() => {
    return projectId ? `project_${projectId}_` : '';
  }, [projectId]);
  
  // Create a helper to generate operation IDs
  const generateOperationId = (operationName: string, key?: string) => {
    const uniqueKey = key || uuidv4();
    return `${operationPrefix}${operationName}_${uniqueKey}`;
  };
  
  // Filter operations to only include those for this project
  const projectOperations = useMemo(() => {
    if (!operationPrefix) return {};
    
    // Filter operations by checking if the operation ID starts with our prefix
    return Object.entries(allOperations)
      .filter(([id]) => id.startsWith(operationPrefix))
      .reduce((acc, [id, operation]) => {
        acc[id] = operation;
        return acc;
      }, {} as Record<string, AsyncOperation>);
  }, [allOperations, operationPrefix]);
  
  // Create actions that are specific to this project
  const operationsActions = useMemo<ProjectOperationsActions>(() => ({
    trackOperation: (operationName, options = {}) => {
      if (!projectId) return '';
      
      const operationId = generateOperationId(operationName, options.key);
      
      // Use the store's function
      storeTrackOperation(operationId, 'pending');
      
      return operationId;
    },
    
    markOperationSuccess: (operationId) => {
      storeTrackOperation(operationId, 'success');
    },
    
    markOperationError: (operationId, error) => {
      storeTrackOperation(operationId, 'error', error);
    },
    
    cleanupOperation: (operationId) => {
      storeCleanupOperation(operationId);
    },
    
    cleanupStaleOperations: () => {
      // The global cleanup handles stale operations across the app
      storeCleanupStaleOperations();
    },
    
    getOperationId: (operationName, key) => {
      return generateOperationId(operationName, key);
    },
    
    isOperationPending: (operationName, key) => {
      const operationId = generateOperationId(operationName, key);
      return storeIsOperationPending(operationId);
    },
    
    isOperationSuccess: (operationName, key) => {
      const operationId = generateOperationId(operationName, key);
      return storeIsOperationSuccess(operationId);
    },
    
    isOperationError: (operationName, key) => {
      const operationId = generateOperationId(operationName, key);
      return storeIsOperationError(operationId);
    },
    
    getOperationError: (operationName, key) => {
      const operationId = generateOperationId(operationName, key);
      return storeGetOperationError(operationId);
    }
  }), [
    projectId,
    operationPrefix,
    storeTrackOperation,
    storeIsOperationPending,
    storeIsOperationSuccess,
    storeIsOperationError,
    storeGetOperationError,
    storeCleanupOperation,
    storeCleanupStaleOperations
  ]);
  
  return {
    operations: projectOperations,
    operationsActions
  };
} 