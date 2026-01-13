"use client";

import React, { useEffect, useMemo, Suspense, lazy } from "react";
import { WidthProvider, Responsive, Layout } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps, ContextActions, GranularTileActions, GranularTabActions, TileLayout, ProjectsActions } from "@/types/interfaces/grid";
import { Loader2, Plus, LayoutGrid } from "lucide-react";
import { Button } from "@/components/UI/button";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { cleanupTileRefs } from '@/utils/interfaces/refRegistry';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";
import { Tile } from "@/contexts/slices/selectors/tile";
import { useGlobalUIMode } from '@/contexts/hooks/useGlobalUIMode';

// Import the new dependency management system
import { useDependencyAwareSortedTilesForTab } from "@/utils/interfaces/tileDependencies/dependencyManager";
import { useUpdateTilesPositionsQuery } from '@/hooks/Interfaces/Query/useTilesQuery';

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const TileHeader = lazy(() => import('../Tile/TileHeader'));
const TileCard = lazy(() => import('../Tile/TileCard'));

interface TabComponentProps {
  tabId: string;
  interfaceId: string;
  projectId: string;
  projectsActions: ProjectsActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  /** Whether tiles are currently being loaded */
  isLoadingTiles?: boolean;
}

const Tab = ({
  tabId,
  interfaceId,
  projectId,
  projectsActions,
  tabActions,
  tileActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  isLoadingTiles = false,
}: TabComponentProps) => {
  const widthFactor = 4;
  const heightFactor = 105;

  const DEBUG_TABS = process.env.NEXT_PUBLIC_DEBUG_TABS === 'true';
  const tabLog = (...args: any[]) => { if (DEBUG_TABS) console.log(...args); };

  // Use granular hooks instead of a general hook
  const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));

  const { data: tabDataState, dataActions: tabDataActions } = useTabData(tabId, interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabId, interfaceId);
  
  // Get global UI mode settings
  const { isEditMode } = useGlobalUIMode();

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
  const syncedTabDataActions = syncedTabActions?.data ?? null;

  // Batch persist positions at interaction end (if supported by actions)
  const updateTilesPositionsMutation = useUpdateTilesPositionsQuery();

  // Get tileIds from store data only
  const tileIds = useMemo(() => {
    return tabDataState?.tileIds || [];
  }, [tabDataState?.tileIds]);

  // Tab only needs sorted tiles
  const { sortedTiles } = useDependencyAwareSortedTilesForTab(
    tabId,
    {
      logDependencyChanges: true,
      enableCircularDependencyDetection: true,
      maxDependencyDepth: 10
    }
  );


  // Get the unregisterTileRefs function from Zustand
  const unregisterTileRefs = useStoreContext(state => state.unregisterTileRefs);

  // End success green after 3 seconds
  useEffect(() => { 
    const timer = setTimeout(() => tabUIActions?.setSaveSuccess(undefined), 3000);
    return () => clearTimeout(timer);
  }, [tabUIState?.saveSuccess, tabUIActions]);

  // Cleanup refs when Tab unmounts or when tiles change
  useEffect(() => {
    // Return cleanup function
    return () => {
      // Clean up refs for all current tiles
      tileIds.forEach((tileId: string) => {
        unregisterTileRefs(tileId);
        cleanupTileRefs(tileId);
      });
    };
  }, [tileIds, unregisterTileRefs]);

  // Item layout change handler
  const onLayoutChange = (newLayouts: Layout[]) => {
    if (!tabUIState?.pending && syncedTabDataActions) {
      newLayouts.forEach((newLayout) => {
        const originalTile = sortedTiles.find((tile: Tile) => tile.id === newLayout.i);

        // Update the tile layout
        const tileLayout: TileLayout = {
          x: Math.round(newLayout.x / widthFactor),
          y: Math.round(newLayout.y / heightFactor),
          w: Math.round(newLayout.w / widthFactor),
          h: Math.round(newLayout.h / heightFactor),
          minW: typeof newLayout.minW === 'number' ? Math.round(newLayout.minW / widthFactor) : undefined,
          minH: typeof newLayout.minH === 'number' ? Math.round(newLayout.minH / heightFactor) : undefined,
          moved: newLayout.moved,
          static: newLayout.static,
        };
        
        syncedTabDataActions.updateTileLayout(originalTile?.id ?? "", tileLayout);
      });
    } else {
      tabUIActions?.setPending(false);
    }
  };

  // Persist final positions on drag/resize stop (batch) when supported
  const persistBatchPositions = (layouts: Layout[]) => {
    // Only proceed if the provided actions implement updateTilesPositions
    const supportsBatch = (tileActions as any)?.updateTilesPositions;
    if (!supportsBatch || !tabId) return;
    try {
      const tiles = layouts.map(l => ({
        id: l.i,
        position: {
          x: Math.round(l.x / widthFactor),
          y: Math.round(l.y / heightFactor),
          width: Math.round(l.w / widthFactor),
          height: Math.round(l.h / heightFactor),
        }
      }));
      updateTilesPositionsMutation.mutate({ tab_id: tabId, tiles, actions: tileActions as any });
    } catch {}
  };

  const dragResizeDisabled = tabUIState?.pending || tabUIState?.resetting;

  // Build the list of tiles to render using the new dependency-aware system
  const tilesToRender = useMemo(() => {
    const renderTiles = sortedTiles.map((tile) => {
      return {
        tileId: tile.id,
        tile,
        element: (
          <Suspense
            key={tile.id}
            fallback={
              <div className="w-full h-full flex items-center justify-center border p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <TileCard
              tileId={tile.id}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              tileActions={tileActions}
              tabActions={tabActions}
              projectsActions={projectsActions}
              logsActions={logsActions}
              fieldsActions={fieldsActions}
              derivedEntryActions={derivedEntryActions}
              contextActions={contextActions}
            />
          </Suspense>
        ),
      };
    });
    
    return renderTiles.filter((renderTile): renderTile is NonNullable<typeof renderTile> => renderTile !== null);
  }, [
    sortedTiles,
    tabId,
    interfaceId,
    projectId,
    tileActions,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions,
    projectsActions,
  ]);

  // ------------------------------------------------------------------
  // Compute tab-level colour override (if any)
  // ------------------------------------------------------------------
  const tabColor = tabUIState?.color ?? null;
  const tabStyle = tabColor ? ({ '--primary': tabColor, '--accent': tabColor } as React.CSSProperties) : undefined;

  // Show loading state if tab data is not yet available
  if (!tabDataState || !tabUIState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show loading state when:
  // 1. Tiles are explicitly loading
  // 2. Tab has tileIds but sortedTiles haven't loaded into store yet
  const hasTileIds = tileIds.length > 0;
  const tilesNotYetHydrated = hasTileIds && sortedTiles.length === 0;
  
  if (isLoadingTiles || tilesNotYetHydrated) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading tiles...</p>
      </div>
    );
  }

  // Show empty state when there are no tiles
  if (sortedTiles.length === 0 && !isLoadingTiles) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <LayoutGrid className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="text-lg font-medium mb-2">No tiles yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isEditMode 
              ? "Click the 'Add tile' button below to create your first tile."
              : "Enable Edit Mode to add tiles to this tab."}
          </p>
        </div>
        {isEditMode && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Plus className="h-4 w-4" />
            <span>Use the <strong>Add tile</strong> button in the bottom left</span>
          </div>
        )}
      </div>
    );
  }

  const newCols = { lg: 12 * widthFactor, md: 12 * widthFactor, sm: 12 * widthFactor, xs: 12 * widthFactor, xxs: 12 * widthFactor };

  return (
    <div style={tabStyle} data-tab-color>
      <ResponsiveReactGridLayout
        onLayoutChange={onLayoutChange}
        onDragStop={persistBatchPositions}
        onResizeStop={persistBatchPositions}
        className="layout interactive-grid flex-1 mx-1 w-full"
        style={{ width: '100%', minWidth: 0 }}
        cols={newCols}
        rowHeight={105 / heightFactor}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        isDraggable={isEditMode && !dragResizeDisabled}
        isResizable={isEditMode && !dragResizeDisabled}
        draggableHandle=".drag"
        resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
        compactType={null}
        preventCollision={true}
      >
        {tilesToRender.map(({ tileId, tile, element }) => {
          // In edit mode, show all tiles; otherwise respect visibility setting
          if (!isEditMode && tile.visible === false) return null;

          return (
            <div
              key={tile.id}
              data-grid={{
                i: tile.id,
                x: tile.position.x * widthFactor,
                y: tile.position.y * heightFactor,
                w: tile.position.width * widthFactor,
                h: tile.position.height * heightFactor,
                minW: typeof tile.minW === 'number' ? tile.minW * widthFactor : undefined,
                minH: typeof tile.minH === 'number' ? tile.minH * heightFactor : undefined,
                moved: tile.moved,
                static: tile.static,
              }}
              className="relative group"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dependency-aware tile renderer */}
              {element}

            </div>
          );
        })}
      </ResponsiveReactGridLayout>
    </div>
  );
};

export default Tab;