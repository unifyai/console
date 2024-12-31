"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import Selection from "@/components/Evals/Details/Selection/Selection";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Plus } from "lucide-react";
import { LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import LogsPlot from "@/components/Evals/Details/Plot/Plot";
import { ResponseProps } from "@/types/common";
import LogsTable from "@/components/Evals/Table/Table";
import { TileProps } from "@/types/evals/grid";

const Card = ({
    searchParams,
    projects,
    project,
    logs,
    params,
    entriesProperties,
    paramsProperties,
    metrics,
    logsData,
    totalPages,
    columnTypes,
    projectActions,
    logsActions,
    index,
    items,
    setItems,
}: {
    searchParams: { project?: string, page_number?: string, metric?: string, filters?: string, common_filter?: string },
    projects: string[] | undefined,
    project: string | undefined,
    logs: LogProps[],
    params: LogItemProps,
    entriesProperties: string[],
    paramsProperties: string[],
    metrics: { [key: string]: number }
    logsData: LogsResponseProps,
    totalPages: number,
    columnTypes: { [key: string]: string },
    projectActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (oldName: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, filterExpression: string | null, limit: number, offset: number) => Promise<LogsResponseProps>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids: string[]) => Promise<ResponseProps>
    },
    index: string,
    items: TileProps[],
    setItems: (items: TileProps[]) => void
}) => {
    const tab = items.find(item => item.i == index)?.tab
    const tabTypes = ["Table", "Plot", "View"]

    return (<div className="overflow-x-auto relative flex w-full h-full border rounded-lg">
        <div className={"overflow-auto w-full flex-1 flex flex-col items-center " + (tab ? "mt-2" : "justify-center")}>
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
            {tab?.includes("View") && <Selection params={params} logs={logs} />}
            {tab?.includes("Plot") && <LogsPlot logs={logs} />}
            {tab?.includes("Table") && <LogsTable
                searchParams={searchParams}
                projects={projects}
                project={project}
                logs={logs}
                columnTypes={columnTypes}
                entriesProperties={entriesProperties}
                paramsProperties={paramsProperties}
                metrics={metrics}
                logsData={logsData}
                totalPages={totalPages}
                projectActions={projectActions}
                logsActions={logsActions}
            />}
        </div>
    </div>)
};

export default Card;
