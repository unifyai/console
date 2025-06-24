"use client";

import React, { useEffect, useMemo, Suspense, lazy } from "react";
import { WidthProvider, Responsive, Layout } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps, ContextActions, CodeActions, GranularTileActions, GranularTabActions, TileLayout, ProjectsActions, FileActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { cleanupTileRefs } from '@/utils/refRegistry';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";
import { Tile } from "@/contexts/slices/selectors/tile";

// Import the new dependency management system
import { useDependencyAwareSortedTilesForTab } from "@/utils/tileDependencies/dependencyManager";

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const TileButtons = lazy(() => import('./TileButtons'));
const TileCard = lazy(() => import('./TileCard'));

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
  codeActions: CodeActions;
  fileActions: FileActions;
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
  codeActions,
  fileActions,
}: TabComponentProps) => {
  // Use granular hooks instead of a general hook
  const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));

  const { data: tabDataState, dataActions: tabDataActions } = useTabData(tabId, interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabId, interfaceId);

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
  const syncedTabDataActions = syncedTabActions?.data ?? null;

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
          x: newLayout.x,
          y: newLayout.y,
          w: newLayout.w,
          h: newLayout.h,
          minW: newLayout.minW,
          minH: newLayout.minH,
          moved: newLayout.moved,
          static: newLayout.static,
        };
        
        syncedTabDataActions.updateTileLayout(originalTile?.id ?? "", tileLayout);
      });
    } else {
      tabUIActions?.setPending(false);
    }
  };

  const dragResizeDisabled = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

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
                <SkeletonLoader />
              </div>
            }
          >
            <TileCard
              tileId={tile.id}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              tileActions={tileActions}
              projectsActions={projectsActions}
              logsActions={logsActions}
              fieldsActions={fieldsActions}
              derivedEntryActions={derivedEntryActions}
              contextActions={contextActions}
              codeActions={codeActions}
              fileActions={fileActions}
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
    codeActions,
    fileActions,
    projectsActions,
  ]);
  
  // Show loading state if tab data is not yet available
  if (!tabDataState || !tabUIState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <SkeletonLoader />
      </div>
    );
  }

  return (
    <ResponsiveReactGridLayout
        onLayoutChange={onLayoutChange}
        className="layout interactive-grid flex-1 mx-1"
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={105}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        isDraggable={tabUIState?.edit && !dragResizeDisabled}
        isResizable={tabUIState?.edit && !dragResizeDisabled}
        draggableHandle=".drag"
        resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
    >
      {tilesToRender.map(({ tileId, tile, element }) => {
        if (!tile.visible) return null;

        return (
          <div
            key={tile.id}
            data-grid={{
              i: tile.id,
              x: tile.position.x,
              y: tile.position.y,
              w: tile.position.width,
              h: tile.position.height,
              minW: tile.minW,
              minH: tile.minH,
              moved: tile.moved,
              static: tile.static,
            }}
            className="relative group"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dependency-aware tile renderer */}
            {element}

            {/* Client-side controls */}
            <TileButtons
              tileId={tile.id}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              tabActions={tabActions}
              tileActions={tileActions}
              logsActions={logsActions}
              contextActions={contextActions}
              codeActions={codeActions}
              projectsActions={projectsActions}
              fieldsActions={fieldsActions}
            />
          </div>
        );
      })}
    </ResponsiveReactGridLayout>
  );
};

export default Tab; 