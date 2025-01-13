"use client";

import { Dispatch, SetStateAction, useEffect } from "react";
import { useRouter } from 'next/navigation';
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import Selection from "@/components/Interface/Details/Selection/Selection";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Plus } from "lucide-react";
import { LogFieldsResponseProps, LogFieldsProps, LogsResponseProps } from "@/types/evals/logs";
import LogsPlot from "@/components/Interface/Details/Plot/Plot";
import { ResponseProps } from "@/types/common";
import LogsTable from "@/components/Interface/Table/Table";
import { ItemType, TableDataProps, TileProps } from "@/types/evals/grid";

const Card = ({
    projects,
    project,
    pending,
    columnTypes,
    tableNames,
    tableData,
    projectActions,
    logsActions,
    index,
    item,
    originalItem,
    items,
    setProject,
    setPending,
    setItems,
    updateItem,
    updateInterface,
    fieldsActions,
    filterExpressions,
    sortingExpressions,
}: {
    projects: string[] | undefined,
    project: string | undefined,
    pending: boolean,
    columnTypes: { [key: string]: string },
    tableNames: string[],
    tableData: TableDataProps,
    projectActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (oldName: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<LogsResponseProps>,
        getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<string>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>
    },
    index: string,
    item: TileProps,
    originalItem: TileProps,
    items: TileProps[],
    setProject: Dispatch<SetStateAction<string | undefined>>,
    setPending: (pending: boolean) => void,
    setItems: (items: TileProps[]) => void,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void
    updateInterface: () => Promise<ResponseProps>,
    fieldsActions: {
        get: (project: string) => Promise<LogFieldsResponseProps>,
    },
    filterExpressions: string[] | null,
    sortingExpressions: (string | null)[],
}) => {
    const router = useRouter();
    const tab = items.find(item => item.i == index)?.tab
    const tabTypes = ["Table", "Plot", "View"];
    const relevantItem = item.table ? items.find(it => it.i == item.table) : undefined

    useEffect(() => {
        if (item.tab == "Table" && JSON.stringify(item) != JSON.stringify(originalItem)) {
            updateInterface().then(() => {
                router.refresh();
                setPending(true);
            });
        }
    }, [item.tab, item.filters, item.common_filter, item.sorting, item.page_number, item.metric]);

    return (<div className="overflow-auto relative flex w-full h-full border rounded-lg">
        <div className={"w-full flex-1 flex flex-col items-center " + (tab ? "mt-2" : "justify-center")}>
            <div className="flex gap-4">
                <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Add Tab"
                            text={tab || undefined}
                            icon={tab ? undefined : <Plus />}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {tabTypes.map((tab, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => setItems(
                                [...items.map(item => item.i != index ? item : { ...item, tab: tab })]
                            )}
                            className="w-64"
                        >
                            {tab}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>
                {tab && ["Plot", "View"].includes(tab) && <div className="w-fit">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Select Table"
                            text={item.table || "Select Table"}
                            variant="outline"
                            size="default"
                        />}
                    >
                        {tableNames.map((tile, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => updateItem(item, "table")(tile)}
                            disabled={tableData[tile].logs.length == 0}
                            className="w-64"
                        >
                            {tile}
                            {tableData[tile].logs.length ? "" : " (empty table)"}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                </div>}
            </div>
            {tab?.includes("View") && <Selection
                logs={item.table ? tableData[item.table]?.logs || [] : []}
                selection_={relevantItem?.selected}
                baseIndex_={relevantItem?.base_index}
                columnOrdering_={relevantItem?.column_order}
                hiddenColumns_={relevantItem?.hidden_columns}
                item={item}
                updateItem={updateItem}
            />}
            {tab?.includes("Plot") && <LogsPlot
                logs={item.table ? tableData[item.table]?.plotLogs || [] : []}
                fields={item.table ? tableData[item.table]?.plotFields || {} : {}}
                item={item}
                updateItem={updateItem}
            />}
            {tab?.includes("Table") && <LogsTable
                projects={projects}
                project={project}
                pending={pending}
                tab={tab}
                item={item}
                logs={tableData[item.i]?.logs || []}
                columnTypes={columnTypes}
                entriesProperties={tableData[item.i]?.entriesProperties || []}
                paramsProperties={tableData[item.i]?.paramsProperties || []}
                metrics={tableData[item.i]?.metrics || {}}
                logsData={tableData[item.i]?.logsData || { params: {}, logs: [], count: 0 }}
                totalPages={tableData[item.i]?.totalPages || 0}
                boundaries={tableData[item.i]?.boundaries || { minimus: {}, maximums: {} }}
                setProject={setProject}
                updateItem={updateItem}
                projectActions={projectActions}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                filterExpression={filterExpressions ? filterExpressions[items.findIndex(it => it.i === item.i)] : null}
                sortingExpression={sortingExpressions ? sortingExpressions[items.findIndex(it => it.i === item.i)] : null}
            />}
        </div>
    </div>)
};

export default Card;
