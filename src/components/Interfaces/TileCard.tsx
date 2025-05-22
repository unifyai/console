"use client";

import React, { useMemo, Suspense, lazy, useEffect } from "react";
import { Plus } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { icons, tabTypes } from "@/constants/logs";
import { DerivedEntryActions, FieldsActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions } from "@/types/evals/grid";
import { LogsActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { TileColorContext } from '@/contexts/TileColorContext';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { useTile } from '@/contexts/hooks/tile';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { getTileCardRef } from '@/utils/refRegistry';
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";

const Tile = lazy(() => import('./Tile'));

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

  return (
  <TileColorContext.Provider value={tileUIState?.color || null}>
    <div ref={tileCardRef} className="relative flex w-full h-full border">
      <div className={"w-full flex-1 flex flex-col items-center " + ((!tabUIState?.edit && tileType) ? "mt-4" : tileType ? "mt-2" : "justify-center")}>
        <div className="flex gap-4 z-20">
          {tabUIState?.edit && <div className="w-fit">
            <BaseDropdown
              context="tile"
              button={<ActionButton
                tooltip="Select tile type"
                text={tileType}
                icon={tileType ? undefined : <Plus />}
                variant="outline"
                size="default"
              />}
            >
              {(!tabUIState?.edit ? [] : tabTypes).map((tabType, idx) => {
                return (
                  <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                      if (tileName) {
                        // If tabType is either a "Table" or "Plot" and the item.table is already set,
                        // then we need to first mark it as null
                        if (tabType === "Table" || tabType === "Plot" && tableName) {
                          syncedTileDataActions?.setTable(undefined);
                        }

                        if (tileType === undefined && tabType === "Table") {
                          syncedTableTileActions?.setTableType("Data Table");
                        }
                        syncedTileMetaActions?.setType(tabType);
                      }
                    }}
                    className="w-64 flex justify-between items-center"
                  >
                    <span>{tabType}</span>{icons[tabType as keyof typeof icons]}
                  </DropdownMenuItem>
                )
              })}
            </BaseDropdown>
          </div>}
          {tileType && tabUIState?.edit && tileType === "View" && <div className="w-fit">
            <BaseDropdown
              context="tile"
              button={<ActionButton
                tooltip="Select table"
                text={tableName || "Select Table"}
                variant="outline"
                size="default"
              />}
            >
              {(!tabUIState?.edit ? [] : tableNames).map((tile, idx) => {
                return (
                  <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                      syncedTileDataActions?.setTable(tile);
                    }}
                    className="w-64"
                  >
                    {tile}
                  </DropdownMenuItem>
                )
              })}
            </BaseDropdown>
          </div>}
        </div>

        {/* Tile content */}
        <Suspense fallback={
          <div className="w-full h-full flex-1 flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }>
          {children || (
            <Tile
                tileId={tileId}
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={projectId}
                tileActions={tileActions}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                derivedEntryActions={derivedEntryActions}
                contextActions={contextActions}
                codeActions={codeActions}
                projectsActions={projectsActions}
            />
          )}
        </Suspense>

      </div>
    </div>
  </TileColorContext.Provider>
  );
};

export default TileCard;
