"use client";

import { useState } from "react";
import Card from "./Card";
import { LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { FileProps, ResponseProps } from "@/types/common";
import FileDirectory from "@/components/Directory/FileDirectory";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import CreateProject from "@/components/Evals/Table/Buttons/CreateProject";

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
    const [cards, setCards] = useState<(string | undefined)[][]>([[undefined]]);

    const updateCards = (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "remove"
    ) => {
        const leftOrRight = side == "left" || side == "right";
        if (type == "add") {
            if (leftOrRight && cards[rowIndex].length < 3) {
                if (side == "left")
                    cards[rowIndex].splice(colIndex, 0, undefined);
                else
                    cards[rowIndex].splice(colIndex + 1, 0, undefined);
            }
            else if (!leftOrRight) {
                if (side == "top")
                    cards.splice(rowIndex, 0, [undefined]);
                else
                    cards.splice(rowIndex + 1, 0, [undefined]);
            }
        } else if ((cards.length > 1 || cards[rowIndex].length > 1)) {
            cards[rowIndex].splice(colIndex, 1);
            if (cards[rowIndex].length == 0)
                cards.splice(rowIndex, 1);
        }
        setCards([...cards]);
    }

    return (
        <div className="w-full h-full">
            {
                cards.map((cardList, index) => (
                    <div className={`flex-col w-full ${cards.length == 1 ? "h-full" : "h-1/2"}`} key={index}>
                        <div className="relative flex-1 flex w-full h-full">
                            {cardList.map((_, subIndex) => (
                                <Card
                                    key={`${index}_${subIndex}`}
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
                            ))}
                        </div>
                    </div>
                ))
            }
        </div >
    )
};

export default CardGrid;
