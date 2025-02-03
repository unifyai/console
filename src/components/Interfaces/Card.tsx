"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import Selection from "@/components/Interfaces/Details/Selection/Selection";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Plus } from "lucide-react";
import { TableArguments, LogFieldsResponseProps } from "@/types/evals/logs";
import LogsPlot from "@/components/Interfaces/Details/Plot/Plot";
import { ResponseProps } from "@/types/common";
import LogsTable from "@/components/Interfaces/Table/Table";
import { DerivedEntryActions, ContextActions, ItemType, LogsActions, PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";
import { maybeFlattenGroupedLogs } from "@/utils/evals/common";

const Card = ({
    mode,
    project,
    pending,
    fields,
    tableNames,
    tableData,
    plotData,
    tableArguments,
    logsActions,
    derivedEntryActions,
    contextActions,
    index,
    item,
    items,
    filterExpressions,
    sortingExpressions,
    groupingExpressions,
    setPending,
    updateItem,
    updateInterface,
}: {
    mode: "edit" | "interactive" | "dashboard",
    project: string | undefined,
    pending: boolean,
    fields: LogFieldsResponseProps,
    tableNames: string[],
    tableData: TableDataProps,
    plotData: PlotDataProps,
    tableArguments: TableArguments,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    index: string,
    item: TileProps,
    items: TileProps[],
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    groupingExpressions: (string | null)[],
    setPending: (pending: boolean) => void,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    updateInterface: () => Promise<ResponseProps>,
}) => {
    
    const router = useRouter();
    const [initial, setInitial] = useState(true);
    const tab = items.find(item => item.i == index)?.tab;
    const tabTypes = ["Table", "Plot", "View"];
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
        item.common_filter,
        item.sorting,
        item.grouping,
        item.page_number,
        item.metric,
        item.plot_type,
        item.x_axis,
        item.y_axis,
    ]);

    useEffect(() => {
        setInitial(false);
    }, []);

    return (<div className="no-drag relative flex w-full h-full border rounded-lg">
        <div className={"w-full flex-1 flex flex-col items-center " + (tab ? "mt-2" : "justify-center")}>
            <div className="flex gap-4 z-20">
                {mode == "edit" && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Add Tab"
                            text={tab || undefined}
                            icon={tab ? undefined : <Plus />}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {(mode != "edit" ? [] : tabTypes).map((tab, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => {
                                if (item.tab == undefined && tab == "Table")
                                    updateItem(item, "table_type")("Data Table");
                                updateItem(item, "tab")(tab);
                            }}
                            className="w-64 no-drag"
                        >
                            {tab}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>}
                {tab && mode == "edit" && tab == "View" && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Select Table"
                            text={item.table || "Select Table"}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {(mode != "edit" ? [] : tableNames).map((tile, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => updateItem(item, "table")(tile)}
                            disabled={(tableData[tile]?.logs || []).length == 0}
                            className="w-64 no-drag"
                        >
                            {tile}
                            {(tableData[tile]?.logs || []).length ? "" : " (empty table)"}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>}
                {tab && mode == "edit" && tab == "Table" && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Select Table Type"
                            text={item.table_type}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {["Data Table", "Derived Table"].map((tableType, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => {
                                if (tableType == "Derived Table") {
                                    if (!item.prev_context) {
                                        contextActions.create(`Derived_${item.i}`, project as string);
                                        updateItem(item, "context")(`Derived_${item.i}`);
                                        updateItem(item, "prev_context")(`Derived_${item.i}`);
                                    }
                                    else
                                        updateItem(item, "context")(item.prev_context);
                                }
                                else
                                    updateItem(item, "context")(undefined);
                                    updateItem(item, "table_type")(tableType);
                            }}
                            className="w-64 no-drag"
                        >
                            {tableType}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>}
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
                interactive={["edit", "interactive"].includes(mode)}
                logs={plotData[item.i]?.plotLogs || []}
                fields={plotData[item.i]?.plotFields || {}}
                item={item}
                updateItem={updateItem}
            />}
            {tab?.includes("Table") && <LogsTable
                interactive={["edit", "interactive"].includes(mode)}
                project={project}
                pending={pending}
                tab={tab}
                item={item}
                fields={fields}
                tableArguments={tableArguments}
                tableDataItem_={{
                    ...(tableData[item.i] || {}),
                    logs: tableData[item.i]?.logs || [],
                    entriesProperties: tableData[item.i]?.entriesProperties || [],
                    paramsProperties: tableData[item.i]?.paramsProperties || [],
                    metrics: tableData[item.i]?.metrics || {},
                    logsData: tableData[item.i]?.logsData || { params: {}, logs: [], count: 0, grouped_entries: {} },
                    totalPages: tableData[item.i]?.totalPages || 0,
                    boundaries: tableData[item.i]?.boundaries || { minimus: {}, maximums: {} }
                }}
                updateItem={updateItem}
                logsActions={logsActions}
                derivedEntryActions={derivedEntryActions}
                filterExpression={filterExpressions ? filterExpressions[items.findIndex(it => it.i === item.i)] : null}
                sortingExpression={sortingExpressions ? sortingExpressions[items.findIndex(it => it.i === item.i)] : null}
                groupingExpression={groupingExpressions ? groupingExpressions[items.findIndex(it => it.i === item.i)] : null}
                updateInterface={updateInterface}
                setPending={setPending}
            />}
        </div>
    </div>);
};

export default Card;
