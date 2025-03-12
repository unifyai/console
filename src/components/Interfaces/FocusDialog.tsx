"use client";

import { Dispatch, SetStateAction } from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import Card from "./Card";
import { Badge } from "../UI/badge";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { TableArguments } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { DerivedEntryActions, Interface, ItemType, LogsActions, FieldsActions, PlotDataProps, TableDataProps, TileProps, Context, ContextActions } from "@/types/evals/grid";
import { Plus, X } from "lucide-react";
import { icons } from "@/constants/logs";

const FocusDialog = ({
    maxTiles,
    maxTileItems,
    edit,
    interactive,
    project,
    contexts,
    context,
    pending,
    dataPending,
    tilePending,
    setTilePending,
    tableNames,
    tableData,
    plotData,
    tableArguments,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions,
    items,
    filterExpressions,
    sortingExpressions,
    groupingExpressions,
    groupSortingExpressions,
    limit,
    offsets,
    updateItem,
    updateInterface,
    setTableData,
    setMaxTiles,
    setFocusDialog,
}: {
    maxTiles: [string | undefined, string | undefined],
    maxTileItems: [TileProps | undefined, TileProps | undefined],
    edit: boolean,
    interactive: boolean,
    project: string | undefined,
    contexts: Context[],
    context: string | undefined,
    pending: boolean,
    dataPending: boolean,
    tilePending: { [key: string]: boolean },
    setTilePending: (tilePending: { [key: string]: boolean }) => void,
    tableNames: string[],
    tableData: TableDataProps,
    plotData: PlotDataProps,
    tableArguments: TableArguments,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    items: TileProps[],
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    groupingExpressions: (string | null)[],
    groupSortingExpressions: (string | null)[],
    limit: number,
    offsets: number[],
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: any | undefined) => void,
    updateInterface: (savedInterface?: Interface | null) => Promise<ResponseProps>,
    setMaxTiles: Dispatch<SetStateAction<[string | undefined, string | undefined]>>,
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
    setFocusDialog: Dispatch<SetStateAction<boolean>>,
}) => {
    const tiles = maxTileItems.map((item: TileProps | undefined, idx: number) => {
        return (
            item
                ? <div className="h-full relative pt-2">
                    <Card
                        edit={edit}
                        interactive={interactive}
                        project={project}
                        pending={pending || dataPending || (item.tab == "Table" ? tilePending[item.i] : false)}
                        contexts={contexts}
                        context={context}
                        tableNames={tableNames}
                        tableData={tableData}
                        tableArguments={tableArguments}
                        plotData={plotData}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        index={item.i}
                        item={item}
                        items={items}
                        filterExpressions={filterExpressions}
                        sortingExpressions={sortingExpressions}
                        groupingExpressions={groupingExpressions}
                        groupSortingExpressions={groupSortingExpressions}
                        limit={limit}
                        offsets={offsets}
                        setPending={(p: boolean) => setTilePending({ ...tilePending, [item.i]: p })}
                        updateItem={updateItem}
                        updateInterface={updateInterface}
                        setTableData={setTableData}
                    />
                    <div className={"w-full px-2 transition-all absolute -top-1 flex justify-between " + (edit ? "h-20" : "h-10")}>
                        <div>
                            <Badge variant="primary">{item.i}</Badge>
                        </div>
                        <div className="mb-auto">
                            <ActionButton
                                className="remove cursor-pointer hover:z-10"
                                onClick={() => {
                                    maxTiles[idx] = undefined;
                                    setMaxTiles([...maxTiles]);
                                    if (maxTiles[0] == undefined && maxTiles[1] == undefined)
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
                            {items.filter(item => !maxTiles.includes(item.i)).map((item, idx_) => <DropdownMenuItem
                                key={idx_}
                                onSelect={() => {
                                    maxTiles[idx] = item.i;
                                    setMaxTiles([...maxTiles]);
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
