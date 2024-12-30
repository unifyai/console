"use client";

import { useEffect, useState } from "react";
import Card from "./Card";
import { LogFieldsResponseProps, LogFieldsProps, LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { getInitialCards, getTabsAndBounds } from "@/utils/evals/grid";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import ActionButton from "../Common/Buttons/Action";
import { Save } from "lucide-react";

export const heights: { [key: number]: string } = {
    1: "h-[100vh]",
    2: "h-[100vh]",
    3: "h-[150vh]",
    4: "h-[200vh]",
    5: "h-[250vh]",
};

export const gridRows: { [key: number]: string } = {
    1: "grid-rows-1",
    2: "grid-rows-2",
    3: "grid-rows-3",
    4: "grid-rows-4",
    5: "grid-rows-5",
};

export const gridCols: { [key: number]: string } = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
};

export const rowSpans: { [key: number]: string } = {
    1: "row-span-1",
    2: "row-span-2",
    3: "row-span-3",
    4: "row-span-4",
    5: "row-span-5",
};

export const colSpans: { [key: number]: string } = {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
};

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
    fieldsActions
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
    fieldsActions: {
        get: (project: string) => Promise<LogFieldsResponseProps>,
        delete: (fields: LogFieldsProps) => Promise<ResponseProps>
    }
}) => {
    const [editable, setEditable] = useState(true);
    const [cards, setCards] = useState<(string | undefined)[][]>(getInitialCards("Empty_1"));
    let { allTabs, cardList, rowBound, colBound } = getTabsAndBounds(cards);

    useEffect(() => {
        const tabsAndBounds = getTabsAndBounds(cards);
        allTabs = tabsAndBounds.allTabs;
        cardList = tabsAndBounds.cardList;
        rowBound = tabsAndBounds.rowBound;
        colBound = tabsAndBounds.colBound;
        if (cardList.length == 1 && (cardList[0].size[0] != 1 || cardList[0].size[1] != 1))
            setCards(getInitialCards(cardList[0].tab));
    }, [cards]);

    return (
        <>
            <div className="my-2 mr-10 flex flex-row-reverse gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Switch checked={editable} onCheckedChange={setEditable} id="editable" />
                    <Label htmlFor="airplane-mode">Editable</Label>
                </div>
                <ActionButton icon={<Save />} tooltip="Save Layout" variant="outline" />
            </div>
            <div className={`m-1 w-full ${heights[rowBound]} overflow-y-scroll grid ${gridRows[rowBound]} ${gridCols[colBound]} gap-4`}>
                {
                    cardList.map(card => {
                        const [row, col] = card.size;
                        const [rowIndex, colIndex] = card.index;
                        return (<div
                            className={`${rowSpans[row]} ${colSpans[col]}`}
                            key={`${rowIndex}_${colIndex}`}
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
                                fieldsActions={fieldsActions}
                                editable={editable}
                                index={[rowIndex, colIndex]}
                                size={[row, col]}
                                bound={[rowBound, colBound]}
                                cards={cards}
                                cardList={cardList}
                                allTabs={allTabs}
                                setCards={setCards}
                            />
                        </div>);
                    })
                }
            </div>
        </>
    )
};

export default CardGrid;
