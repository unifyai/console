"use client";

import React, { ReactNode, Suspense, lazy, useEffect } from "react";
import { DerivedEntryActions, FieldsActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions, GranularTabActions } from "@/types/interfaces/grid";
import { LogsActions } from "@/types/interfaces/grid";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import UnlinkedTileOverlay from "./UnlinkedTileOverlay";
import { TileColorContext } from '@/contexts/TileColorContext';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { useTile, useTileUI } from '@/contexts/hooks/tile';
import { resolveColorHierarchy } from "@/utils/interfaces/plots/common";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { getTileCardRef } from '@/utils/interfaces/refRegistry';
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";

const TileHeader = lazy(() => import('./TileHeader'));
const TileFooter = lazy(() => import('./TileFooter'));
const TileRenderer = lazy(() => import('./TileRenderer'));

interface TileCardProps {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
  children?: ReactNode;
}

const TileCard = ({
  tileId,
  tabId,
  interfaceId,
  projectId,
  tabActions,
  tileActions,
  projectsActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions,
  fileActions,
  children,
}: TileCardProps) => {

  // Get refs from the registry instead of creating or receiving them via props
  const tileCardRef = getTileCardRef(tileId);

  // Register that this tile has initialized its refs via Zustand
  const registerTileRefs = useStoreContext(state => state.registerTileRefs);

  // Register refs on mount
  useEffect(() => {
    registerTileRefs(tileId);
    // Clean up is handled by the parent component
  }, [tileId, registerTileRefs]);

  // Use tab hooks for tab-level state
  const { ui: tabUIState } = useTabUI(tabId, interfaceId);
  const { dataActions: tabDataActions } = useTabData(tabId, interfaceId);

  // Use granular tile hooks for tile-specific state
  const { meta: tileMetaState, ui: tileUIState, data: tileDataState } = useTile(tileId, tabId);

  // SYNCHRONISED TILE-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTileActions } = useTileSync(
    tileId,
    tabId,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );
  const syncedTileDataActions = syncedTileActions?.data ?? null;

  const tableNames = tabDataActions?.getTileNamesByType("Table").filter(Boolean) as string[] || [];

  const tileType = tileMetaState?.type ?? undefined;
  const tileName = tileMetaState?.name;
  const tableName = tileDataState?.table;

  // Resolve color using hierarchical precedence (but keep null if no colors set)
  const resolvedColor = tileUIState?.color || tabUIState?.color || null;

  return (
    <TileColorContext.Provider value={resolvedColor}>
      <div ref={tileCardRef} className="relative flex w-full h-full border">
        <div className={"w-full flex-1 flex flex-col items-center"}>

          {tileType === "View" && !tableName && tabUIState?.edit && (
            <UnlinkedTileOverlay
              tileType={tileType}
              tileName={tileName}
              tableNames={tableNames}
              onSelectTable={(selectedTable) => syncedTileDataActions?.setTable(selectedTable)}
              isEditMode={tabUIState?.edit || false}
            />
          )}

          {/* Tile header */}
          <TileHeader
            tileId={tileId}
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

          {/* Tile content */}
          {!!tileType && <Suspense
              key={tileId}
              fallback={
                <div className="w-full h-full flex-1 flex items-center justify-center">
                  <SkeletonLoader />
                </div>
              }
            >
              <TileRenderer
                tileId={tileId}
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={projectId}
                actions={{
                  tileActions,
                  projectsActions,
                  logsActions,
                  fieldsActions,
                  derivedEntryActions,
                  contextActions,
                  codeActions,
                  fileActions,
                }}
              />
            </Suspense>
          }
        </div>
      </div>
    </TileColorContext.Provider>
  );
};

export default TileCard;