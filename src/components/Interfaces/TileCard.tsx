"use client";

import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { useTile } from "@/contexts/hooks/useTile";
import { icons, tabTypes } from "@/constants/logs";
import { useTab } from "@/contexts/hooks/useTab";
import { ResponseProps } from "@/types/common";
import { DerivedEntryActions, FieldsActions } from "@/types/evals/grid";
import { LogsActions } from "@/types/evals/grid";
import Tile from "./Tile";

interface TileCardProps {
  index: number;
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  updateTab: (savedTab?: any) => Promise<ResponseProps>;
  getLatestTab: () => void;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
}

const TileCard = ({
  index,
  tileId,
  tabId,
  interfaceId,
  projectId,
  updateTab,
  getLatestTab,
  logsActions,
  fieldsActions,
  derivedEntryActions
}: TileCardProps) => {

  const { tab: tabData, actions: tabActions } = useTab(tabId, interfaceId);

  // Derive tiles from tab data
  const tiles = tabData ? Object.values(tabData.tiles || {}) : [];

  // Get tile props using the getItems function from the tabActions
  const tileProps = useMemo(() => {
    return (!tabActions || !tabData) ? [] : tabActions.getItems();
  }, [tabActions, tabData]);

  const tableNames = useMemo(() => {
    // Only return table names for table tiles
    // Return should be an array of strings only
    return tileProps.map(item => item.tab == "Table" ? item.i : null).filter(Boolean) as string[];
  }, [tileProps]);

  // Get the current item based on the index prop
  const item = tileProps[index];
  const tab = item.tab;
  
  // Call useTile once at the top level of the component for the current item
  const { actions: tileActions } = useTile(item?.i, tabId, interfaceId, projectId);

  // Define tableData as a computed property based on the tiles
  const logsLengths = useMemo(() => {
    return tiles.reduce((acc: Record<string, number>, tile) => {
      if (tile.type === 'Table' && tile.name) {
        acc[tile.name] = tile.tableData?.tableDataItem?.logs?.length || 0;
      }
      return acc;
    }, {});
  }, [tiles]);

  return (
    <div className="relative flex w-full h-full border">
      <div className={"w-full flex-1 flex flex-col items-center " + ((!tabData?.edit && tab) ? "mt-4" : tab ? "mt-2" : "justify-center")}>
        <div className="flex gap-4 z-20">
          {tabData?.edit && <div className="w-fit">
            <BaseDropdown
              button={<ActionButton
                tooltip="Select Tile Type"
                text={item?.tab}
                icon={item?.tab ? undefined : <Plus />}
                variant="outline"
                size="default"
              />}
            >
              {(!tabData?.edit ? [] : tabTypes).map((tab, idx) => {
                return (
                  <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                      if (item?.tab == undefined && tab == "Table") {
                        tileActions?.updateTableData({ table_type: "Data Table" });
                      }
                      tabActions?.updateTile(item?.i, { type: tab });
                    }}
                    className="w-64 flex justify-between items-center"
                  >
                    <span>{tab}</span>{icons[tab as keyof typeof icons]}
                  </DropdownMenuItem>
                )
              })}
            </BaseDropdown>
          </div>}
          {tab && tabData?.edit && tab == "View" && <div className="w-fit">
            <BaseDropdown
              button={<ActionButton
                tooltip="Select Table"
                text={item?.table || "Select Table"}
                variant="outline"
                size="default"
              />}
            >
              {(!tabData?.edit ? [] : tableNames).map((tile, idx) => {
                return (
                  <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                      tileActions?.updateTile({ table: tile });
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
        <Tile
            tileId={item?.i}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            updateTab={updateTab}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            derivedEntryActions={derivedEntryActions}
        />

      </div>
    </div>
  );
};

export default TileCard;
