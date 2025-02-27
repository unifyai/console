"use client";

import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import Selection from "@/components/Interfaces/Details/Selection/Selection";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { TableArguments } from "@/types/evals/logs";
import LogsPlot from "@/components/Interfaces/Details/Plot/Plot";
import { ResponseProps } from "@/types/common";
import LogsTable from "@/components/Interfaces/Table/Table";
import { DerivedEntryActions, ItemType, LogsActions, FieldsActions, PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";
import { maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import { icons, tabTypes } from "@/constants/logs";
import { Context } from "@/types/evals/grid";
import { Plus } from "lucide-react";
import { ExpandProvider } from "@/contexts/ExpandContext";

import { useInterfaceContext } from "@/components/Providers/Stores/InterfaceStoreProvider";

const Card = ({
    index,
    project,
    contexts,
    context,
    tableNames,
    plotData,
    tableArguments,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    filterExpressions,
    sortingExpressions,
    groupingExpressions,
    groupSortingExpressions,
    limit,
    offsets,
    updateInterface,
}: {
    index: string,
    project: string | undefined,
    contexts: Context[],
    context: string | undefined,
    tableNames: string[],
    plotData: PlotDataProps,
    tableArguments: TableArguments,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    groupingExpressions: (string | null)[],
    groupSortingExpressions: (string | null)[],
    limit: number,
    offsets: number[],
    updateInterface: () => Promise<ResponseProps>,
}) => {

    const router = useRouter();

    const item = useInterfaceContext((s) => s.items.find(it => it.i == index));
    const items = useInterfaceContext((s) => s.items);
    const tableData = useInterfaceContext((s) => s.tableData);
    const updateItem = useInterfaceContext((s) => s.updateItem);

    const edit = useInterfaceContext((s) => s.edit);
    const interactive = useInterfaceContext((s) => s.interactive);
    const tilePending = useInterfaceContext((s) => s.tilePending);
    const pending = useInterfaceContext((s) => s.pending || s.dataPending || (item?.tab === "Table" ? tilePending[item?.i] : false));
    const setPending = useInterfaceContext((s) => s.setPending);

    const initial = useInterfaceContext((s) => s.cardInitial);
    const setInitial = useInterfaceContext((s) => s.setCardInitial);

    const tab = item?.tab;

    // Use a ref to compare the needed properties so we only update if something truly changed.
    useEffect(() => {
        if (item?.tab != "View" && !initial) {
            updateInterface().then(() => {
                router.refresh();
            }).catch(error => {
                console.error('Error updating interface:', error);
            });
        }
    }, [
        item?.tab,
        item?.table_type,
        item?.filters,
        item?.context,
        item?.column_context,
        item?.common_filter,
        item?.sorting,
        item?.grouping,
        item?.group_sorting,
        item?.page_number,
        item?.metric,
        item?.plot_type,
        item?.x_axis,
        item?.y_axis,
        item?.plot_group_by,
        item?.auto_update,
        item?.freeze
    ]);

    useEffect(() => {
        if (item?.tab != "View" && !initial)
            setPending(true);
    }, [item?.tab, item?.table_type, item?.context, item?.column_context]);

    useEffect(() => {
        setInitial(false);
    }, []);

    return (<div className="relative flex w-full h-full border">
        <div className={"w-full flex-1 flex flex-col items-center " + ((!edit && tab) ? "mt-4" : tab ? "mt-2" : "justify-center")}>
            <div className="flex gap-4 z-20">
                {edit && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Select Tile Type"
                            text={item?.tab}
                            icon={item?.tab ? undefined : <Plus />}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {(!edit ? [] : tabTypes).map((tab, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => {
                                if (item?.tab == undefined && tab == "Table")
                                    updateItem(item as TileProps, "table_type")("Data Table");
                                updateItem(item as TileProps, "tab")(tab);
                            }}
                            className="w-64 flex justify-between items-center"
                        >
                            <span>{tab}</span>{icons[tab as keyof typeof icons]}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>}
                {tab && edit && tab == "View" && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Select Table"
                            text={item?.table || "Select Table"}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {(!edit ? [] : tableNames).map((tile, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => updateItem(item, "table")(tile)}
                            disabled={(tableData[tile]?.logs || []).length == 0}
                            className="w-64"
                        >
                            {tile}
                            {(tableData[tile]?.logs || []).length ? "" : " (empty table)"}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>}
            </div>
            {tab?.includes("View") && (
                <div className="w-full overflow-auto">
                    <ExpandProvider>
                        <Selection
                            index={item?.i || ""}
                        />
                    </ExpandProvider>
                </div>
            )}
            {tab?.includes("Plot") && (
                <LogsPlot
                    interactive={interactive}
                    pending={pending}
                    logsActions={logsActions}
                    fieldsActions={fieldsActions}
                    project={project}
                    plotDataItem_={plotData[item?.i || ""]}
                    tableNames={tableNames}
                    item={item as TileProps}
                    updateItem={updateItem}
                />
            )}
            {tab?.includes("Table") && (
                <LogsTable
                    index={index}
                    project={project}
                    contexts={contexts}
                    context_={context}
                    tableArguments={tableArguments}
                    fieldsActions={fieldsActions}
                    logsActions={logsActions}
                    derivedEntryActions={derivedEntryActions}
                    filterExpression={filterExpressions ? filterExpressions[items.findIndex(it => it.i === item?.i)] : null}
                    sortingExpression={sortingExpressions ? sortingExpressions[items.findIndex(it => it.i === item?.i)] : null}
                    groupingExpression={groupingExpressions ? groupingExpressions[items.findIndex(it => it.i === item?.i)] : null}
                    groupSortingExpression={groupSortingExpressions ? groupSortingExpressions[items.findIndex(it => it.i === item?.i)] : null}
                    limit={limit}
                    offset={offsets ? offsets[items.findIndex(it => it.i === item?.i)] : 0}
                    updateInterface={updateInterface}
                />
            )}
        </div>
    </div>);
};

export default Card;
