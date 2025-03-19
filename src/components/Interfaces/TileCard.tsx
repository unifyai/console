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
import { DerivedEntryActions, FieldsActions, ContextActions, TabProps, TileProps } from "@/types/evals/grid";
import { LogsActions } from "@/types/evals/grid";
import Tile from "./Tile";
import { useStore } from "@/contexts/hooks/useStore";

interface TileCardProps {
  index: number;
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  updateTab: (savedTab?: TabProps | null, updatedTileProps?: TileProps[] | TileProps | null) => Promise<ResponseProps>;
  getLatestTab: () => void;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
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
  derivedEntryActions,
  contextActions,
}: TileCardProps) => {

  const { 
    ui: tabUIState, 
    dataActions: tabDataActions,
    uiActions: tabUIActions
  } = useTab(tabId, interfaceId);

  // Get tile props using the getItems function from the tabUIActions
  const tileProps = useMemo(() => {
    return !tabUIActions ? [] : tabUIActions.getItems();
  }, [tabUIActions]);

  const tableNames = useMemo(() => {
    // Only return table names for table tiles
    // Return should be an array of strings only
    return tileProps.map(item => item.tab === "Table" ? item.i : null).filter(Boolean) as string[];
  }, [tileProps]);

  // Get the current item based on the index prop
  const item = tileProps[index];
  const tab = item?.tab;
  
  // Call useTile once at the top level of the component for the current item
  const { dataActions: tileDataActions } = useTile(item?.i, tabId, interfaceId, projectId);

  // Define logsLengths as a computed property based on the tiles
  const logsLengths = useStore().getLogLengths();

  return (
    <div className="relative flex w-full h-full border">
      <div className={"w-full flex-1 flex flex-col items-center " + ((!tabUIState?.edit && tab) ? "mt-4" : tab ? "mt-2" : "justify-center")}>
        <div className="flex gap-4 z-20">
          {tabUIState?.edit && <div className="w-fit">
            <BaseDropdown
              button={<ActionButton
                tooltip="Select Tile Type"
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
                        tabDataActions?.updateTile(item.i, { type: tabType });
                        if (item?.tab === undefined && tabType === "Table") {
                          tabDataActions?.updateTableTile(item.i, { table_type: "Data Table" });
                        }
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
              button={<ActionButton
                tooltip="Select Table"
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
        <Tile
            tileId={item?.i}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            updateTab={updateTab}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            derivedEntryActions={derivedEntryActions}
            contextActions={contextActions}
        />

      </div>
    </div>
  );
};

export default TileCard;
