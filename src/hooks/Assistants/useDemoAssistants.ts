/**
 * Hook for managing demo assistants.
 *
 * This hook handles:
 * - Loading demo assistants and source assistants
 * - Creating new demo assistants
 * - Demo selection and detail loading (contacts, spending)
 * - Toast notifications for operations
 */

import * as React from 'react';
import { toast } from 'sonner';
import {
  DemoActions,
  DemoAssistant,
  DemoAssistantCreatePayload,
  DemoAssistantMeta,
  DemoContact,
} from '@/types/demo';
import { Assistant } from '@/types/assistants/assistant';
import { AssistantSpend } from '@/types/assistants/spending';

// =============================================================================
// Types
// =============================================================================

export interface UseDemoAssistantsResult {
  /** List of demo assistants */
  demoAssistants: DemoAssistant[];

  /** List of source assistants available for cloning */
  sourceAssistants: Assistant[];

  /** Whether initial data is loading */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Whether a create operation is in progress */
  isCreating: boolean;

  /** Currently selected demo assistant */
  selectedDemo: DemoAssistant | null;

  /** Contacts for the selected demo assistant */
  contacts: DemoContact[];

  /** Spending data for the selected demo assistant */
  spending: AssistantSpend | null;

  /** Metadata for the selected demo assistant (includes label) */
  meta: DemoAssistantMeta | null;

  /** Whether detail data is loading (contacts, spending, meta) */
  isLoadingDetails: boolean;

  /** Refresh all data */
  refresh: () => Promise<void>;

  /** Create a new demo assistant */
  createDemoAssistant: (payload: DemoAssistantCreatePayload) => Promise<DemoAssistant | null>;

  /** Select a demo assistant and load its details */
  selectDemo: (demo: DemoAssistant) => Promise<void>;

  /** Clear the current selection */
  clearSelection: () => void;

  /** Delete a demo assistant */
  deleteDemoAssistant: (assistantId: string) => Promise<boolean>;

  /** Whether a delete operation is in progress */
  isDeleting: boolean;

  /** Refresh contacts for the selected demo assistant */
  refreshContacts: () => Promise<void>;

  /** Whether contacts are being refreshed */
  isRefreshingContacts: boolean;
}

// =============================================================================
// Helper
// =============================================================================

function isResponseError(response: unknown): response is { detail: string } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'detail' in response &&
    typeof (response as { detail: unknown }).detail === 'string'
  );
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDemoAssistants(actions: DemoActions): UseDemoAssistantsResult {
  const [demoAssistants, setDemoAssistants] = React.useState<DemoAssistant[]>([]);
  const [sourceAssistants, setSourceAssistants] = React.useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // Selection and detail state
  const [selectedDemo, setSelectedDemo] = React.useState<DemoAssistant | null>(null);
  const [contacts, setContacts] = React.useState<DemoContact[]>([]);
  const [spending, setSpending] = React.useState<AssistantSpend | null>(null);
  const [meta, setMeta] = React.useState<DemoAssistantMeta | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRefreshingContacts, setIsRefreshingContacts] = React.useState(false);

  const isMountedRef = React.useRef(true);

  /**
   * Fetches demo assistants and source assistants.
   */
  const fetchData = React.useCallback(
    async (showLoadingToast = false) => {
      if (!isMountedRef.current) return;

      setIsLoading(true);
      setError(null);

      let toastId: string | number | undefined;
      if (showLoadingToast) {
        toastId = toast.loading('Refreshing demo assistants...');
      }

      try {
        // Load demo assistants
        const demosResult = await actions.list();
        if (!isMountedRef.current) return;

        if (isResponseError(demosResult)) {
          throw new Error(demosResult.detail);
        }

        if (Array.isArray(demosResult)) {
          setDemoAssistants(demosResult);
        }

        // Load source assistants
        const sourcesResult = await actions.listSourceAssistants();
        if (!isMountedRef.current) return;

        if (isResponseError(sourcesResult)) {
          console.warn('Failed to load source assistants:', sourcesResult.detail);
        } else if (Array.isArray(sourcesResult)) {
          setSourceAssistants(sourcesResult);
        }

        if (toastId) {
          toast.dismiss(toastId);
        }
      } catch (err) {
        if (!isMountedRef.current) return;

        const errorMsg = err instanceof Error ? err.message : 'Failed to load demo assistants';
        setError(errorMsg);

        if (toastId) {
          toast.error('Failed to load demo assistants', { id: toastId });
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [actions]
  );

  /**
   * Creates a new demo assistant.
   */
  const createDemoAssistant = React.useCallback(
    async (payload: DemoAssistantCreatePayload): Promise<DemoAssistant | null> => {
      if (!isMountedRef.current) return null;

      setIsCreating(true);
      const toastId = toast.loading('Creating demo assistant...');

      try {
        const result = await actions.create(payload);

        if (!isMountedRef.current) return null;

        if (isResponseError(result)) {
          throw new Error(result.detail);
        }

        // At this point, result is DemoAssistant
        const demoAssistant = result as DemoAssistant;

        // Add to local state
        setDemoAssistants((prev) => [...prev, demoAssistant]);

        toast.success(
          `${demoAssistant.firstName} ${demoAssistant.surname} created with phone ${demoAssistant.phone || 'pending'}`,
          { id: toastId }
        );

        return demoAssistant;
      } catch (err) {
        if (!isMountedRef.current) return null;

        const errorMsg = err instanceof Error ? err.message : 'Failed to create demo assistant';
        toast.error(errorMsg, { id: toastId });
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsCreating(false);
        }
      }
    },
    [actions]
  );

  /**
   * Public refresh function.
   */
  const refresh = React.useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  /**
   * Select a demo and load its details (contacts, spending).
   */
  const selectDemo = React.useCallback(
    async (demo: DemoAssistant): Promise<void> => {
      if (!isMountedRef.current) return;

      // Skip if same demo is already selected
      if (selectedDemo?.agentId === demo.agentId) {
        return;
      }

      setSelectedDemo(demo);
      setIsLoadingDetails(true);
      setContacts([]);
      setSpending(null);
      setMeta(null);

      try {
        // Load metadata (for label)
        const metaResult = await actions.getMeta(demo.demoId);
        if (!isMountedRef.current) return;

        if (isResponseError(metaResult)) {
          console.warn('Failed to load metadata:', metaResult.detail);
        } else {
          setMeta(metaResult as DemoAssistantMeta);
        }

        // Load contacts
        const contactsResult = await actions.getContacts(demo.agentId);
        if (!isMountedRef.current) return;

        if (isResponseError(contactsResult)) {
          toast.error(contactsResult.detail);
        } else if (Array.isArray(contactsResult)) {
          setContacts(contactsResult);
        }

        // Load spending
        const spendingResult = await actions.getSpending(demo.agentId);
        if (!isMountedRef.current) return;

        if (isResponseError(spendingResult)) {
          // Spending error is non-critical, just log
          console.warn('Failed to load spending:', spendingResult.detail);
        } else {
          setSpending(spendingResult as AssistantSpend);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Error loading demo details:', err);
      } finally {
        if (isMountedRef.current) {
          setIsLoadingDetails(false);
        }
      }
    },
    [actions, selectedDemo?.agentId]
  );

  /**
   * Clear the current selection.
   */
  const clearSelection = React.useCallback(() => {
    setSelectedDemo(null);
    setContacts([]);
    setSpending(null);
    setMeta(null);
    setIsLoadingDetails(false);
  }, []);

  /**
   * Delete a demo assistant.
   */
  const deleteDemoAssistant = React.useCallback(
    async (assistantId: string): Promise<boolean> => {
      if (!isMountedRef.current) return false;

      setIsDeleting(true);
      const toastId = toast.loading('Deleting demo assistant...');

      try {
        const result = await actions.delete(assistantId);

        if (!isMountedRef.current) return false;

        if (isResponseError(result)) {
          throw new Error(result.detail);
        }

        // Remove from local state
        setDemoAssistants((prev) => prev.filter((d) => d.agentId !== assistantId));

        // Clear selection if the deleted demo was selected
        if (selectedDemo?.agentId === assistantId) {
          clearSelection();
        }

        toast.success('Demo assistant deleted', { id: toastId });
        return true;
      } catch (err) {
        if (!isMountedRef.current) return false;

        const errorMsg = err instanceof Error ? err.message : 'Failed to delete demo assistant';
        toast.error(errorMsg, { id: toastId });
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsDeleting(false);
        }
      }
    },
    [actions, selectedDemo?.agentId, clearSelection]
  );

  /**
   * Refresh contacts for the currently selected demo.
   */
  const refreshContacts = React.useCallback(async (): Promise<void> => {
    if (!isMountedRef.current || !selectedDemo) return;

    setIsRefreshingContacts(true);

    try {
      const contactsResult = await actions.getContacts(selectedDemo.agentId);
      if (!isMountedRef.current) return;

      if (isResponseError(contactsResult)) {
        toast.error(contactsResult.detail);
      } else if (Array.isArray(contactsResult)) {
        setContacts(contactsResult);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error refreshing contacts:', err);
      toast.error('Failed to refresh contacts');
    } finally {
      if (isMountedRef.current) {
        setIsRefreshingContacts(false);
      }
    }
  }, [actions, selectedDemo]);

  // Effect: Initial load
  React.useEffect(() => {
    isMountedRef.current = true;
    fetchData(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  return {
    demoAssistants,
    sourceAssistants,
    isLoading,
    error,
    isCreating,
    selectedDemo,
    contacts,
    spending,
    meta,
    isLoadingDetails,
    isDeleting,
    isRefreshingContacts,
    refresh,
    createDemoAssistant,
    refreshContacts,
    selectDemo,
    clearSelection,
    deleteDemoAssistant,
  };
}
