"use client";

import { Dispatch, SetStateAction, useMemo } from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { Badge } from "../UI/badge";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { TableArguments } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { DerivedEntryActions, TabProps, ItemType, LogsActions, FieldsActions, PlotDataProps, TableDataProps, TileProps, Context } from "@/types/evals/grid";
import { Plus, X } from "lucide-react";
import { icons } from "@/constants/logs";
import TileCard from "./TileCard";
import { useTab } from "@/contexts/hooks/useTab";

const FocusDialog = ({
    interfaceId,
    projectId,
    tabId,
    updateTab,
    getLatestTab,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    setFocusDialog,
}: {
    interfaceId: string;
    projectId: string;
    tabId: string;
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    updateTab: (savedTab?: any) => Promise<ResponseProps>;
    getLatestTab: () => void;
    setFocusDialog: Dispatch<SetStateAction<boolean>>,
}) => {
    const { tab: tabData, actions: tabActions } = useTab(tabId, interfaceId);
    // Get tile props using the getItems function from the tabActions
    const tileProps = !tabActions || !tabData ? [] : tabActions.getItems();

    const focusedTileIds = tabData?.focusedTileIds;

    const focusedTileItems: [{ item: TileProps | undefined, index: number } | undefined, { item: TileProps | undefined, index: number } | undefined] = focusedTileIds?.map(
        tile => {
            const index = tileProps.findIndex(item => item.i == tile);
            const item = index !== -1 ? tileProps[index] : undefined;
            return index !== -1 ? { item, index } : undefined;
        }
    ) as [{ item: TileProps | undefined, index: number } | undefined, { item: TileProps | undefined, index: number } | undefined];

    const tiles = focusedTileItems.map((tileData: { item: TileProps | undefined, index: number } | undefined, idx: number) => {
        const item = tileData?.item as TileProps;
        const index = tileData?.index as number;
        return (
            item
                ? <div className="h-full relative pt-2">
                    <TileCard
                        index={index}
                        tileId={item.i}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        updateTab={updateTab}
                        getLatestTab={getLatestTab}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                    />
                    <div className={"w-full px-2 transition-all absolute -top-1 flex justify-between " + (tabData?.edit ? "h-20" : "h-10")}>
                        <div>
                            <Badge variant="primary">{item.i}</Badge>
                        </div>
                        <div className="mb-auto">
                            <ActionButton
                                className="remove cursor-pointer hover:z-10"
                                onClick={() => {
                                    focusedTileIds![idx] = undefined;
                                    tabActions?.setFocusedTileIds([...focusedTileIds!]);
                                    if (focusedTileIds![0] == undefined && focusedTileIds![1] == undefined)
                                        setFocusDialog(false);
                                }}
                                icon={<X />}
                                tooltip="Remove from Focus Pane"
                                variant="outline"
                            />
                        </div>
                    </div>
                </div>
                : <div className="h-full w-full flex justify-center items-center">
                    <div className="w-fit">
                        <BaseDropdown
                            button={<ActionButton
                                tooltip="Select Tile"
                                icon={<Plus />}
                                variant="outline"
                                size="default"
                            />}
                        >
                            {tileProps.filter(item => !focusedTileIds!.includes(item.i)).map((item, idx_) => <DropdownMenuItem
                                key={idx_}
                                onSelect={() => {
                                    focusedTileIds![idx] = item.i;
                                    tabActions?.setFocusedTileIds([...focusedTileIds!]);
                                }}
                                className="w-64 flex justify-between items-center"
                            >
                                <span>{item.i}</span>{item.tab ? icons[item.tab as keyof typeof icons] : ""}
                            </DropdownMenuItem>)}
                        </BaseDropdown>
                    </div>
                </div>
        );
    });
    return (
        <DoublePanels
            isLoading={false}
            first={<div className="h-full overflow-auto p-2">{tiles[0]}</div>}
            second={<div className="h-full overflow-auto p-2">{tiles[1]}</div>}
        />
    );
};

export default FocusDialog;
