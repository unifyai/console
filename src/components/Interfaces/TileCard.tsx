"use client";

import React, { useMemo, Suspense, lazy, useEffect } from "react";
import { Plus } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { icons, tabTypes } from "@/constants/logs";
import { DerivedEntryActions, FieldsActions, ContextActions, TileProps, CodeActions, GranularTileActions } from "@/types/evals/grid";
import { LogsActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { TileColorContext } from '@/contexts/TileColorContext';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { useTileData, useTileUI } from '@/contexts/hooks/tile';
import { useLogLengths } from "@/contexts/hooks/useStore";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { getTileCardRef } from '@/utils/refRegistry';

const Tile = lazy(() => import('./Tile'));

interface TileCardProps {
  index: number;
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  children?: React.ReactNode;
}

const TileCard = ({
  index,
  tileId,
  tabId,
  interfaceId,
  projectId,
  tileActions,
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
  const {ui: tileUIState} = useTileUI(tileId, tabId, interfaceId);
  const { dataActions: tileDataActions } = useTileData(tileId, tabId, interfaceId);

  // Get tile props using the getItems function from the tabDataActions
  const tileProps = useMemo(() => {
    return !tabDataActions ? [] : tabDataActions.getItems();
  }, [tabDataActions]);

  const tableNames = useMemo(() => {
    // Only return table names for table tiles
    // Return should be an array of strings only
    return tileProps.map((item: TileProps) => item.tab === "Table" ? item.i : null).filter(Boolean) as string[];
  }, [tileProps]);

  // Get the current item based on the index prop
  const item = tileProps[index];
  const tab = item?.tab;
  
  // Define logsLengths as a computed property based on the tiles
  const logsLengths = useLogLengths();

  return (
  <TileColorContext.Provider value={tileUIState?.color || null}>
    <div ref={tileCardRef} className="relative flex w-full h-full border">
      <div className={"w-full flex-1 flex flex-col items-center " + ((!tabUIState?.edit && tab) ? "mt-4" : tab ? "mt-2" : "justify-center")}>
        <div className="flex gap-4 z-20">
          {tabUIState?.edit && <div className="w-fit">
            <BaseDropdown
              context="tile"
              button={<ActionButton
                tooltip="Select tile type"
                text={item?.tab}
                icon={item?.tab ? undefined : <Plus />}
                variant="outline"
                size="default"
              />}
            >
              {(!tabUIState?.edit ? [] : tabTypes).map((tabType, idx) => {
                return (
                  <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                      if (item?.i) {
                        // If tabType is either a "Table" or "Plot" and the item.table is already set,
                        // then we need to first mark it as null
                        if (tabType === "Table" || tabType === "Plot" && item.table) {
                          tileDataActions?.setTable("");
                        }

                        if (item?.tab === undefined && tabType === "Table") {
                          tabDataActions?.updateTableTile(item.i, { table_type: "Data Table" });
                        }
                        tabDataActions?.updateTile(item.i, { type: tabType });
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
          {tab && tabUIState?.edit && tab === "View" && <div className="w-fit">
            <BaseDropdown
              context="tile"
              button={<ActionButton
                tooltip="Select table"
                text={item?.table || "Select Table"}
                variant="outline"
                size="default"
              />}
            >
              {(!tabUIState?.edit ? [] : tableNames).map((tile, idx) => {
                return (
                  <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                      tileDataActions?.setTable(tile);
                    }}
                    disabled={!logsLengths[tile]}
                    className="w-64"
                  >
                    {tile}
                    {logsLengths[tile] ? "" : " (empty table)"}
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
                tileId={item?.i}
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={projectId}
                tileActions={tileActions}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                derivedEntryActions={derivedEntryActions}
                contextActions={contextActions}
                codeActions={codeActions}
            />
          )}
        </Suspense>

      </div>
    </div>
  </TileColorContext.Provider>
  );
};

export default TileCard;
