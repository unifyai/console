"use client";

import { Dispatch, SetStateAction } from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import Card from "./Card";
import { Badge } from "../UI/badge";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { TableArguments } from "@/types/evals/logs";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { ContextActions, DerivedEntryActions, Interface, ItemType, LogsActions, PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";
import { X } from "lucide-react";

const FocusDialog = ({
    maxTiles,
    maxTileItems,
    edit,
    interactive,
    project,
    pending,
    dataPending,
    tilePending,
    setTilePending,
    fields,
    tableNames,
    tableData,
    plotData,
    tableArguments,
    logsActions,
    derivedEntryActions,
    contextActions,
    items,
    filterExpressions,
    sortingExpressions,
    groupingExpressions,
    limit,
    offsets,
    updateItem,
    updateInterface,
    setTableData,
    setMaxTiles,
    setFocusDialog,
}: {
    maxTiles: string[],
    maxTileItems: (TileProps | undefined)[],
    edit: boolean,
    interactive: boolean,
    project: string | undefined,
    pending: boolean,
    dataPending: boolean,
    tilePending: { [key: string]: boolean },
    setTilePending: (tilePending: { [key: string]: boolean }) => void,
    fields: LogFieldsResponseProps,
    tableNames: string[],
    tableData: TableDataProps,
    plotData: PlotDataProps,
    tableArguments: TableArguments,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    items: TileProps[],
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    groupingExpressions: (string | null)[],
    limit: number,
    offsets: number[],
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: any | undefined) => void,
    updateInterface: (savedInterface?: Interface | null) => Promise<ResponseProps>,
    setMaxTiles: Dispatch<SetStateAction<string[]>>,
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
    setFocusDialog: Dispatch<SetStateAction<boolean>>,
}) => {
    const tiles = maxTileItems.map((item: TileProps | undefined) => {
        return (
            item
                ? <div className="h-full relative pt-2">
                    <Card
                        edit={edit}
                        interactive={interactive}
                        project={project}
                        pending={pending || dataPending || (item.tab == "Table" ? tilePending[item.i] : false)}
                        tableNames={tableNames}
                        tableData={tableData}
                        tableArguments={tableArguments}
                        fields={fields}
                        plotData={plotData}
                        logsActions={logsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        index={item.i}
                        item={item}
                        items={items}
                        filterExpressions={filterExpressions}
                        sortingExpressions={sortingExpressions}
                        groupingExpressions={groupingExpressions}
                        limit={limit}
                        offsets={offsets}
                        setPending={(p: boolean) => setTilePending({ ...tilePending, [item.i]: p })}
                        updateItem={updateItem}
                        updateInterface={updateInterface}
                        setTableData={setTableData}
                    />
                    <div className={"w-full px-2 transition-all absolute -top-1 flex justify-between " + (edit ? "h-20" : "h-10")}>
                        <div>
                            <Badge
                                className="no-drag"
                                variant="primary"
                            >
                                {item.i}
                            </Badge>
                        </div>
                        <div className="mb-auto">
                            <ActionButton
                                className="no-drag remove cursor-pointer hover:z-10"
                                onClick={() => {
                                    const newMaxTiles = maxTiles.filter(t => t != item.i);
                                    setMaxTiles(newMaxTiles);
                                    if (newMaxTiles.length == 0)
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
                                text="Select Tile"
                                variant="outline"
                                size="default"
                            />}
                        >
                            {items.map((item, idx) => <DropdownMenuItem
                                key={idx}
                                onSelect={() => {
                                    if (idx == 0)
                                        setMaxTiles([item.i, ...maxTiles])
                                    else
                                        setMaxTiles([...maxTiles, item.i])
                                }}
                                className="w-64 no-drag"
                            >
                                {item.i}
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
