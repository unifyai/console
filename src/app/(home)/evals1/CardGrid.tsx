"use client";

import { useEffect, useState } from "react";
import Card from "./Card";
import { LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";

export interface CardProps {
    tab: string | undefined,
    size: [number, number]
}

const CardGrid = ({
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
}) => {
    const [cards, setCards] = useState<CardProps[][]>([[{ tab: undefined, size: [1, 1] }]]);
    let numCols = Math.max(...cards.map((cardList) => cardList.length));

    useEffect(() => {
        numCols = Math.max(...cards.map((cardList) => cardList.length));
    }, [cards]);

    const updateCards = (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "remove" | "merge"
    ) => {
        const leftOrRight = side == "left" || side == "right";
        if (type == "add") {
            if (leftOrRight && cards[rowIndex].length < 3) {
                if (cards[rowIndex][colIndex].size[1] > 1) {
                    const size = cards[rowIndex][colIndex].size;
                    cards[rowIndex][colIndex] = { ...cards[rowIndex][colIndex], size: [size[0], size[1] - 1] };
                }
                if (side == "left")
                    cards[rowIndex].splice(colIndex, 0, { tab: undefined, size: [1, 1] });
                else
                    cards[rowIndex].splice(colIndex + 1, 0, { tab: undefined, size: [1, 1] });
            }
            else if (!leftOrRight) {
                if (side == "top")
                    cards.splice(rowIndex, 0, [{ tab: undefined, size: [1, numCols] }]);
                else
                    cards.splice(rowIndex + 1, 0, [{ tab: undefined, size: [1, numCols] }]);
            }
        } else if (type == "remove" && (cards.length > 1 || cards[rowIndex].length > 1)) {
            cards[rowIndex].splice(colIndex, 1);
            if (cards[rowIndex].length == 0)
                cards.splice(rowIndex, 1);
        } else if (type == "merge") {
            if (side == "left") {
                cards[rowIndex][colIndex].size[1] += cards[rowIndex][colIndex - 1].size[1];
                cards[rowIndex].splice(colIndex - 1, 1);
            }
            else if (side == "right") {
                cards[rowIndex][colIndex].size[1] += cards[rowIndex][colIndex + 1].size[1];
                cards[rowIndex].splice(colIndex + 1, 1);
            }
            else if (side == "top") {
                cards[rowIndex - 1][colIndex].size[0] += cards[rowIndex][colIndex].size[0];
                cards[rowIndex].splice(colIndex, 1);
            }
            else if (side == "bottom") {
                cards[rowIndex][colIndex].size[0] += cards[rowIndex + 1][colIndex].size[0];
                cards[rowIndex + 1].splice(colIndex, 1);
            }
        }
        setCards([...cards]);
    }

    return (
        <div className={`m-1 w-full h-[${cards.length > 1 ? cards.length * 50 : 100}vh] overflow-y-scroll grid grid-rows-${cards.length} grid-cols-${numCols} gap-4`}>
            {
                cards.map((cardList, index) => {
                    return <>{cardList.map((card, subIndex) => {
                        const [row, col] = card.size;
                        return (<div
                            className={`${row > 1 ? "row-span-" + row.toString() : ""} ${col > 1 ? "col-span-" + col.toString() : ""}`}
                            key={`${index}_${subIndex}`}
                        >
                            <Card
                                searchParams={searchParams}
                                projects={projects}
                                project={project}
                                logs={logs}
                                params={params}
                                entriesProperties={entriesProperties}
                                paramsProperties={paramsProperties}
                                metrics={metrics}
                                logsData={logsData}
                                totalPages={totalPages}
                                columnTypes={columnTypes}
                                projectActions={projectActions}
                                logsActions={logsActions}
                                rowIndex={index}
                                colIndex={subIndex}
                                cards={cards}
                                setCards={setCards}
                                updateCards={updateCards}
                            />
                        </div>);
                    })}</>
                })
            }
        </div >
    )
};

export default CardGrid;
