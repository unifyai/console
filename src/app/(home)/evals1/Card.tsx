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
import { CardProps } from "./CardGrid";

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
    cards: CardProps[][],
    setCards: Dispatch<SetStateAction<CardProps[][]>>,
    updateCards: (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "remove" | "merge"
    ) => void
}) => {
    const tabTypes = ["Table", "Plot", "View"]
    const setTab = (tab: string) => {
        cards[rowIndex][colIndex].tab = tab
        setCards([...cards]);
    }
    const [hovered, setHovered] = useState(false);
    return (<div className="overflow-x-auto relative flex w-full h-full border rounded-lg" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="h-full w-full flex justify-between">
            <div className={"h-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                <TileButtons
                    side="left"
                    full={cards[rowIndex].length == 3}
                    empty={cards.length == 1 && cards[rowIndex].length == 1}
                    merge={
                        colIndex - 1 >= 0 &&
                        cards[rowIndex][colIndex - 1].size[0] == cards[rowIndex][colIndex].size[0]
                    }
                    onClick={
                        (type: "add" | "remove" | "merge") => updateCards(rowIndex, colIndex, "left", type)
                    }
                />
            </div>
            <div className="flex-1 h-full flex flex-col justify-between">
                <div className={"w-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                    <TileButtons
                        side="top"
                        full={false}
                        empty={cards.length == 1 && cards[rowIndex].length == 1}
                        merge={
                            rowIndex - 1 >= 0 && colIndex < cards[rowIndex - 1].length &&
                            cards[rowIndex - 1][colIndex].size[1] == cards[rowIndex][colIndex].size[1]
                        }
                        onClick={
                            (type: "add" | "remove" | "merge") => updateCards(rowIndex, colIndex, "top", type)
                        }
                    />
                </div>
                <div className={"overflow-auto w-full flex-1 flex flex-col items-center " + (cards[rowIndex][colIndex].tab ? "mt-1" : "justify-center")}>
                    <div className="w-fit">
                        <BaseDropdown
                            button={<ActionButton
                                tooltip="Add Tab"
                                text={cards[rowIndex][colIndex].tab || undefined}
                                icon={cards[rowIndex][colIndex].tab ? undefined : <Plus />}
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
                    {cards[rowIndex][colIndex].tab == "View" && <Selection params={params} logs={logs} />}
                    {cards[rowIndex][colIndex].tab == "Plot" && <LogsPlot logs={logs} />}
                    {cards[rowIndex][colIndex].tab == "Table" && <LogsTable
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
                        merge={
                            rowIndex + 1 < cards.length && colIndex < cards[rowIndex + 1].length &&
                            cards[rowIndex + 1][colIndex].size[1] == cards[rowIndex][colIndex].size[1]
                        }
                        onClick={
                            (type: "add" | "remove" | "merge") => updateCards(rowIndex, colIndex, "bottom", type)
                        }
                    />
                </div>
            </div>
            <div className={"h-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                <TileButtons
                    side="right"
                    full={cards[rowIndex].length == 3}
                    empty={cards.length == 1 && cards[rowIndex].length == 1}
                    merge={
                        colIndex + 1 < cards[rowIndex].length &&
                        cards[rowIndex][colIndex + 1].size[0] == cards[rowIndex][colIndex].size[0]
                    }
                    onClick={
                        (type: "add" | "remove" | "merge") => updateCards(rowIndex, colIndex, "right", type)
                    }
                />
            </div>
        </div>
    </div>)
};

export default Card;
