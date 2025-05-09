import { useCallback } from "react";
import { useTabRouterRefresh } from "./useTabRouterRefresh";
import { GranularTabActions, GranularTileActions } from "@/types/evals/grid";
import { useUpdateTabUnifiedQuery } from "@/hooks/Query/useTabsQuery";
import { usePatchTileQuery } from "@/hooks/Query/useTilesQuery";
import { useTab } from "../useTab";

type TabSyncActions = {
  removeContextFromTab: (context: string) => void;
};

/**
 * A hook that provides tab actions that are synchronized with server state
 * through React Query and router refreshes.
 *
 * @param tabId - The ID of the tab
 * @param interfaceId - The ID of the interface
 * @param projectId - The ID of the project
 * @param tabActions - The granular tab actions for server-side operations
 * @param tileActions - The granular tile actions for server-side operations
 * @param setExternalPending - Optional function to set external pending state during operations
 */
export function useTabSync(
  tabId: string | null,
  interfaceId: string | null,
  projectId: string | null,
  tabActions: GranularTabActions | undefined,
  tileActions: GranularTileActions | undefined,
  setExternalPending?: (pending: boolean) => void
) {
  // Get tab UI actions for router refresh coordination
  const { actions: tabOriginalActions, ui: tabUi, data: tabData, dataActions: tabDataActions } = useTab(tabId, interfaceId, projectId);
  
  // Mutation hooks for server state updates
  const updateTabMutation = useUpdateTabUnifiedQuery();
  const patchTileMutation = usePatchTileQuery();
  
  // Get router refresh function with pending state handling
  const refreshRouter = useTabRouterRefresh(tabOriginalActions?.ui ?? null, setExternalPending);

  /**
   * Remove a context from a tab and all its tiles that use this context
   */
  const removeContextFromTab = useCallback(
    async (context: string) => {
      if (!tabId || !tabActions || !tileActions) return;

      // Check if we have access to the tab data
      if (!tabData || !tabOriginalActions?.data) {
        return;
      }

      // 1) Update local state immediately
      tabDataActions.removeContextFromTab(context);

      // Update the tab's global context if it matches
      if (tabData.globalContext === context) {
        await updateTabMutation.mutateAsync({
          params: {
            id: tabId,
            data: {
              global_context: ""
            }
          },
          actions: tabActions
        });
      }

      // Update all tiles in the tab that use this context
      const tileIds = tabOriginalActions.data.getTileIds();
      const promises = tileIds.map(async (tileId: string) => {
        // Get tile using the provided tile name
        const tileName = tileId.split('>').pop() || '';
        const tile = tabOriginalActions.data.getTile(tileName);
        
        if (tile) {
          const updates: { context?: string; column_context?: string } = {};
          let needsUpdate = false;
          
          if (tile.context === context) {
            updates.context = "";
            needsUpdate = true;
          }
          
          if (tile.column_context === context) {
            updates.column_context = "";
            needsUpdate = true;
          }
          
          if (needsUpdate && tileActions) {
            return patchTileMutation.mutateAsync({
              tab_id: tabId,
              name: tileName,
              updateData: updates,
              actions: tileActions
            });
          }
        }
        
        return Promise.resolve();
      });
      
      // Wait for all updates to complete
      await Promise.all(promises);
      
      // Refresh the router to update UI with new data
      // The pending state is handled by the router refresh hook
      refreshRouter();
    },
    [
      tabId, 
      tabActions,
      tileActions,
      tabOriginalActions,
      tabData,
      updateTabMutation,
      patchTileMutation,
      refreshRouter
    ]
  );

  // Return wrapped actions
  return {
    actions: tabOriginalActions ? {
      ...tabOriginalActions,
      removeContextFromTab,
    } : null
  };
} 