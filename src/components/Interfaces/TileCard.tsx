"use client";

import React, { Suspense, lazy, useEffect } from "react";
import { Plus } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { icons, tabTypes } from "@/constants/logs";
import { DerivedEntryActions, FieldsActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions } from "@/types/evals/grid";
import { LogsActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import UnlinkedTileOverlay from "./UnlinkedTileOverlay";
import { TileColorContext } from '@/contexts/TileColorContext';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { useTile } from '@/contexts/hooks/tile';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { getTileCardRef } from '@/utils/refRegistry';
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";
import { resolveColorHierarchy } from "@/utils/evals/plots/common";

const TileRenderer = lazy(() => import('./TileRenderer'));

interface TileCardProps {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
  children?: React.ReactNode;
}

const TileCard = ({
  tileId,
  tabId,
  interfaceId,
  projectId,
  tileActions,
  projectsActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions,
  fileActions,
  children
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
    tileId, tabId, tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );
  const syncedTileDataActions = syncedTileActions?.data ?? null;
  const syncedTileMetaActions = syncedTileActions?.meta ?? null;
  const syncedTableTileActions = syncedTileActions?.tableTileActions ?? null;

  const tableNames = tabDataActions?.getTileNamesByType("Table").filter(Boolean) as string[];

  const tileType = tileMetaState?.type ?? undefined;
  const tileName = tileMetaState?.name;
  const tableName = tileDataState?.table;

  // Resolve color using hierarchical precedence (but keep null if no colors set)
  const resolvedColor = tileUIState?.color || tabUIState?.color || null;

  return (
  <TileColorContext.Provider value={resolvedColor}>
    <div ref={tileCardRef} className="relative flex w-full h-full border">
      <div className={"w-full flex-1 flex flex-col items-center " + ((!tabUIState?.edit && tileType && tileType !== "Plot") ? "mt-4" : (tileType && tileType !== "Plot") ? "mt-8" : tileType === "Plot" ? "" : "justify-center")}>
        {/* Show overlay for unlinked View tiles that need linking */}
        {tileType === "View" && !tableName && tabUIState?.edit && (
          <UnlinkedTileOverlay
            tileType={tileType}
            tileName={tileName}
            tableNames={tableNames}
            onSelectTable={(selectedTable) => syncedTileDataActions?.setTable(selectedTable)}
            isEditMode={tabUIState?.edit || false}
          />
        )}

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
          </Suspense>}

      </div>
    </div>
  </TileColorContext.Provider>
  );
};

export default TileCard;
