"use client";

import { Dispatch, SetStateAction, useState } from "react";
import TileButtons from "./TileButtons";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import Selection from "@/components/Evals/Details/Selection/Selection";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Plus } from "lucide-react";
import { LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import LogsPlot from "@/components/Evals/Details/Plot/Plot";
import { ResponseProps } from "@/types/common";
import LogsTable from "@/components/Evals/Table/Table";

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
    rowIndex,
    colIndex,
    cards,
    setCards,
    updateCards
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
    columnTypes: { [key: string]: string }
    projectActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (oldName: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    }
    logsActions: {
        get: (project: string, filterExpression: string | null, limit: number, offset: number) => Promise<LogsResponseProps>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids: string[]) => Promise<ResponseProps>
    },
    rowIndex: number,
    colIndex: number
    cards: (string | undefined)[][],
    setCards: Dispatch<SetStateAction<(string | undefined)[][]>>,
    updateCards: (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "remove"
    ) => void
}) => {
    const tabTypes = ["Table", "Plot", "View"]
    const setTab = (tab: string) => {
        cards[rowIndex][colIndex] = tab
        setCards([...cards]);
    }
    const [hovered, setHovered] = useState(false);
    return (<div className="overflow-auto relative flex w-full border rounded-lg m-3 p-3" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="h-full w-full flex justify-between">
            <div className={"h-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                <TileButtons
                    side="left"
                    full={cards[rowIndex].length == 3}
                    empty={cards.length == 1 && cards[rowIndex].length == 1}
                    onClick={
                        (type: "add" | "remove") => updateCards(rowIndex, colIndex, "left", type)
                    }
                />
            </div>
            <div className="flex-1 h-full flex flex-col justify-between">
                <div className={"w-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                    <TileButtons
                        side="top"
                        full={false}
                        empty={cards.length == 1 && cards[rowIndex].length == 1}
                        onClick={
                            (type: "add" | "remove") => updateCards(rowIndex, colIndex, "top", type)
                        }
                    />
                </div>
                <div className={"w-full flex-1 flex flex-col gap-4 items-center " + (cards[rowIndex][colIndex] ? "mt-2" : "justify-center")}>
                    <div className="w-fit">
                        <BaseDropdown
                            button={<ActionButton
                                tooltip="Add Tab"
                                text={cards[rowIndex][colIndex] || undefined}
                                icon={cards[rowIndex][colIndex] ? undefined : <Plus />}
                                variant="outline"
                                size="default"
                            />}
                        >
                            {tabTypes.map((tab, index) => <DropdownMenuItem
                                key={index}
                                onSelect={() => setTab(tab)}
                                className="w-64"
                            >
                                {tab}
                            </DropdownMenuItem>)}
                        </BaseDropdown>
                    </div>
                    {cards[rowIndex][colIndex] == "View" && <Selection params={params} logs={logs} />}
                    {cards[rowIndex][colIndex] == "Plot" && <LogsPlot logs={logs} />}
                    {cards[rowIndex][colIndex] == "Table" && <LogsTable
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
                <div className={"w-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                    <TileButtons
                        side="bottom"
                        full={false}
                        empty={cards.length == 1 && cards[rowIndex].length == 1}
                        onClick={
                            (type: "add" | "remove") => updateCards(rowIndex, colIndex, "bottom", type)
                        }
                    />
                </div>
            </div>
            <div className={"h-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                <TileButtons
                    side="right"
                    full={cards[rowIndex].length == 3}
                    empty={cards.length == 1 && cards[rowIndex].length == 1}
                    onClick={
                        (type: "add" | "remove") => updateCards(rowIndex, colIndex, "right", type)
                    }
                />
            </div>
        </div>
    </div>)
};

export default Card;
