"use client";

import { DoublePanels } from "../Common/Body/DoublePanels";
import Card from "./Card";
import { Badge } from "../UI/badge";
import { TableArguments } from "@/types/evals/logs";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { ContextActions, DerivedEntryActions, Interface, ItemType, LogsActions, PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";

const   FocusDialog = ({
    maxTileItems,
    mode,
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
}: {
    maxTileItems: (TileProps | undefined)[],
    mode: "edit" | "interactive" | "dashboard",
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
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
}) => {
    const tiles = maxTileItems.map((item: TileProps | undefined) => {
        return (
            item
            ? <>
                <Card
                    mode={mode}
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
                <div className={"w-full px-2 transition-all absolute top-5 flex justify-between " + (mode == "edit" ? "h-20" : "h-10")}>
                    <div className="mb-auto">
                        <Badge
                            className="no-drag"
                            variant="primary"
                        >
                            {item.i}
                        </Badge>
                    </div>
                </div>
            </>
            : <></>
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
