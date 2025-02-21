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
import ContextSelector from "./ContextSelector";
import { Context } from "@/types/evals/grid";
import { Plus } from "lucide-react";

const Card = ({
    edit,
    interactive,
    project,
    pending,
    contexts,
    tableNames,
    tableData,
    plotData,
    tableArguments,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    index,
    item,
    items,
    filterExpressions,
    sortingExpressions,
    groupingExpressions,
    limit,
    offsets,
    setPending,
    updateItem,
    updateInterface,
    setTableData,
}: {
    edit: boolean,
    interactive: boolean,
    project: string | undefined,
    pending: boolean,
    contexts: Context[],
    tableNames: string[],
    tableData: TableDataProps,
    plotData: PlotDataProps,
    tableArguments: TableArguments,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    index: string,
    item: TileProps,
    items: TileProps[],
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    groupingExpressions: (string | null)[],
    limit: number,
    offsets: number[],
    setPending: (pending: boolean) => void,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    updateInterface: () => Promise<ResponseProps>,
    setTableData: (updater: (prev: TableDataProps) => TableDataProps) => void,
}) => {

    const router = useRouter();
    const [initial, setInitial] = useState(true);
    const tab = items.find(item => item.i == index)?.tab;
    const relevantItem = item.table ? items.find(it => it.i == item.table) : undefined;

    // Use a ref to compare the needed properties so we only update if something truly changed.
    useEffect(() => {
        if (item.tab != "View" && !initial) {
            updateInterface().then(() => {
                router.refresh();
            }).catch(error => {
                console.error('Error updating interface:', error);
            });
        }
    }, [
        item.tab,
        item.table_type,
        item.filters,
        item.context,
        item.column_context,
        item.common_filter,
        item.sorting,
        item.grouping,
        item.page_number,
        item.metric,
        item.plot_type,
        item.x_axis,
        item.y_axis,
        item.plot_group_by
    ]);

    useEffect(() => {
        if (item.tab != "View" && !initial)
            setPending(true);
    }, [item.tab, item.table_type, item.context, item.column_context]);

    useEffect(() => {
        setInitial(false);
    }, []);

    return (<div className="relative flex w-full h-full border">
        <div className={"w-full flex-1 flex flex-col items-center " + (tab ? "mt-2" : "justify-center")}>
            <div className="flex gap-4 z-20">
                {edit && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Add Tab"
                            text={item.tab}
                            icon={item.tab ? undefined : <Plus />}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {(!edit ? [] : tabTypes).map((tab, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => {
                                if (item.tab == undefined && tab == "Table")
                                    updateItem(item, "table_type")("Data Table");
                                updateItem(item, "tab")(tab);
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
                            text={item.table || "Select Table"}
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
                {tab && edit && tab == "Table" && <ContextSelector
                    contexts={contexts}
                    tableData={tableData}
                    item={item}
                    updateItem={updateItem}
                />}
            </div>
            {tab?.includes("View") && <div className="w-full overflow-auto"><Selection
                params={item.table ? tableData[item.table]?.params : {}}
                logs={item.table ? maybeFlattenGroupedLogs(tableData[item.table]?.logs || []) : []}
                selection_={relevantItem?.selected}
                baseIndex_={relevantItem?.base_index}
                columnOrdering_={relevantItem?.column_order}
                hiddenColumns_={relevantItem?.hidden_columns}
                tableItem={items.find(it => it.i == item.table) || {i: item.table, x: -1, y: -1, w: -1, h: -1} as TileProps}
                item={item}
                updateItem={updateItem}
            /></div>}
            {tab?.includes("Plot") && <LogsPlot
                interactive={interactive}
                pending={pending}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                project={project}
                plotDataItem_={plotData[item.i]}
                tableNames={tableNames}
                item={item}
                updateItem={updateItem}
            />}
            {tab?.includes("Table") && <LogsTable
                interactive={interactive}
                project={project}
                pending={pending}
                tab={tab}
                item={item}
                tableArguments={tableArguments}
                tableDataItem_={{
                    ...(tableData[item.i] || {}),
                    logs: tableData[item.i]?.logs || [],
                    entriesProperties: tableData[item.i]?.entriesProperties || [],
                    paramsProperties: tableData[item.i]?.paramsProperties || [],
                    metrics: tableData[item.i]?.metrics || {},
                    logsData: tableData[item.i]?.logsData || { params: {}, logs: [], count: 0, groups: {} },
                    totalPages: tableData[item.i]?.totalPages || 0,
                    boundaries: tableData[item.i]?.boundaries || { minimus: {}, maximums: {} }
                }}
                setTableData={setTableData}
                updateItem={updateItem}
                fieldsActions={fieldsActions}
                logsActions={logsActions}
                derivedEntryActions={derivedEntryActions}
                filterExpression={filterExpressions ? filterExpressions[items.findIndex(it => it.i === item.i)] : null}
                sortingExpression={sortingExpressions ? sortingExpressions[items.findIndex(it => it.i === item.i)] : null}
                groupingExpression={groupingExpressions ? groupingExpressions[items.findIndex(it => it.i === item.i)] : null}
                limit={limit}
                offset={offsets ? offsets[items.findIndex(it => it.i === item.i)] : 0}
                updateInterface={updateInterface}
                setPending={setPending}
            />}
        </div>
    </div>);
};

export default Card;
