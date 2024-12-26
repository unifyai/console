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
    rowBound,
    colBound,
    cards,
    cardList,
    allTabs,
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
    rowIndex: number,
    colIndex: number,
    rowBound: number,
    colBound: number,
    cards: (string | undefined)[][],
    cardList: CardProps[],
    allTabs: string[],
    setCards: Dispatch<SetStateAction<(string | undefined)[][]>>,
    updateCards: (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "remove" | "merge"
    ) => void
}) => {
    const tabTypes = ["Table", "Plot", "View"]
    const setTab = (tabString: string) => {
        const initialValue = cards[rowIndex][colIndex];
        console.log(`indices: ${rowIndex} ${colIndex} ${cards[rowIndex][colIndex]} ${allTabs} ${tabString}`);
        const lastTab = allTabs.sort(
            (a, b) => parseInt(a.split("_")[1]) - parseInt(b.split("_")[1])
        ).findLast((tab) => tab.includes(tabString));
        const tabIndex = lastTab ? parseInt(lastTab?.split("_")[1]) + 1 : 1;
        for (let i = 0; i < cards.length; i++) {
            for (let j = 0; j < cards[i].length; j++) {
                if (cards[i][j] == initialValue) {
                    cards[i][j] = `${tabString}_${tabIndex}`;
                }
            }
        }
        setCards([...cards]);
    }
    const [hovered, setHovered] = useState(false);
    const cardData = cardList.find((card) => card.tab == cards[rowIndex][colIndex]) as CardProps;
    return (<div className="overflow-x-auto relative flex w-full h-full border rounded-lg" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="h-full w-full flex justify-between">
            <div className={"h-full flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
                <TileButtons
                    side="left"
                    full={colBound == 3}
                    empty={rowBound == 1 && colBound == 1}
                    merge={
                        colIndex - 1 >= 0 &&
                        cardList.find(
                            (card) => card.tab == cards[rowIndex][colIndex - 1]
                        )?.size[0] == cardData.size[0]
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
                        empty={rowBound == 1 && colBound == 1}
                        merge={
                            rowIndex - 1 >= 0 && colIndex < cards[rowIndex - 1].length &&
                            cardList.find(
                                (card) => card.tab == cards[rowIndex - 1][colIndex]
                            )?.size[1] == cardData.size[1]
                        }
                        onClick={
                            (type: "add" | "remove" | "merge") => updateCards(rowIndex, colIndex, "top", type)
                        }
                    />
                </div>
                <div className={"overflow-auto w-full flex-1 flex flex-col items-center " + (cards[rowIndex][colIndex]?.includes("Empty") ? "justify-center" : "mt-1")}>
                    <div className="w-fit">
                        <BaseDropdown
                            button={<ActionButton
                                tooltip="Add Tab"
                                text={cards[rowIndex][colIndex]?.includes("Empty") ? undefined : cards[rowIndex][colIndex]}
                                icon={cards[rowIndex][colIndex]?.includes("Empty") ? <Plus /> : undefined}
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
                    {cards[rowIndex][colIndex]?.includes("View") && <Selection params={params} logs={logs} />}
                    {cards[rowIndex][colIndex]?.includes("Plot") && <LogsPlot logs={logs} />}
                    {cards[rowIndex][colIndex]?.includes("Table") && <LogsTable
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
                        empty={rowBound == 1 && colBound == 1}
                        merge={
                            rowIndex + 1 < cards.length && colIndex < cards[rowIndex + 1].length &&
                            cardList.find(
                                (card) => card.tab == cards[rowIndex + 1][colIndex]
                            )?.size[1] == cardData.size[1]
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
                    full={colBound == 3}
                    empty={rowBound == 1 && colBound == 1}
                    merge={
                        colIndex + 1 < cards[rowIndex].length &&
                        cardList.find(
                            (card) => card.tab == cards[rowIndex][colIndex + 1]
                        )?.size[0] == cardData.size[0]
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
