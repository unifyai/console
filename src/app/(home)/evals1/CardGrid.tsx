"use client";

import { CSSProperties, useEffect, useState } from "react";
import Card from "./Card";
import { LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";

export interface CardProps {
    tab: string;
    size: number[];
    index: number[];
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
    const [cards, setCards] = useState<(string | undefined)[][]>(
        Array.from({ length: 10 }, (_, index: number) => (
            index == 0 ? ["Empty_1", ...Array(2).fill(undefined)] : Array(3).fill(undefined)
        ))
    );
    let allTabs = Array.from(new Set(cards.reduce((row, col) => [...row, ...col], []).filter(tab => tab != undefined)));
    let rowBound = cards.findIndex(row => row.every(card => card == undefined));
    let colBound = [0, 1, 2].findIndex(index => cards.every(row => row[index] == undefined));
    colBound = colBound == -1 ? 3 : colBound;
    let cardList = allTabs.filter(
        tab => cards.find(cl => cl.find(card => card == tab))
    ).map(tab => {
        const rowIndex = cards.findIndex(cl => cl.find(card => card == tab));
        const colIndex = cards[rowIndex].findIndex(card => card == tab);
        let rowSpan = 1, colSpan = 1;
        while (cards[rowIndex + rowSpan] && cards[rowIndex + rowSpan][colIndex] == tab)
            rowSpan++;
        while (cards[rowIndex][colIndex + colSpan] == tab)
            colSpan++;
        return {
            tab: tab,
            size: [rowSpan, colSpan],
            index: [rowIndex, colIndex],
        }
    });

    useEffect(() => {
        allTabs = Array.from(new Set(cards.reduce((row, col) => [...row, ...col], []).filter(tab => tab != undefined)));
        cardList = allTabs.filter(
            tab => cards.find(cl => cl.find(card => card == tab))
        ).map(tab => {
            const rowIndex = cards.findIndex(cl => cl.find(card => card == tab));
            const colIndex = cards[rowIndex].findIndex(card => card == tab);
            let rowSpan = 1, colSpan = 1;
            while (cards[rowIndex + rowSpan] && cards[rowIndex + rowSpan][colIndex] == tab)
                rowSpan++;
            while (cards[rowIndex][colIndex + colSpan] == tab)
                colSpan++;
            return {
                tab: tab,
                size: [rowSpan, colSpan],
                index: [rowIndex, colIndex],
            }
        });
        if (cardList.length == 1 && (cardList[0].size[0] != 1 || cardList[0].size[1] != 1)) {
            const card = cardList[0];
            setCards(
                Array.from({ length: 10 }, (_, index: number) => (
                    index == 0 ? [card.tab, ...Array(2).fill(undefined)] : Array(3).fill(undefined)
                ))
            );
        }
        else {
            rowBound = cards.findIndex(row => row.every(card => card == undefined));
            colBound = [0, 1, 2].findIndex(index => cards.every(row => row[index] == undefined));
            colBound = colBound == -1 ? 3 : colBound;
        }
    }, [cards]);

    const updateCards = (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "reset" | "merge"
    ) => {
        const initialValue = cards[rowIndex][colIndex];
        let newRowIndex = rowIndex, newColIndex = colIndex;
        if (side == "left")
            newColIndex--;
        else if (side == "right")
            newColIndex++;
        else if (side == "top")
            newRowIndex--;
        else
            newRowIndex++;

        const lastTab = allTabs.sort(
            (a, b) => parseInt(a.split("_")[1]) - parseInt(b.split("_")[1])
        ).findLast((tab) => tab.includes("Empty"));
        let emptyIndex = lastTab ? parseInt(lastTab?.split("_")[1]) + 1 : 1;

        let finalRowIndex = newRowIndex, finalColIndex = newColIndex;
        while (cards[finalRowIndex][finalColIndex] == initialValue)
            finalRowIndex++;
        while (cards[finalRowIndex][finalColIndex] == initialValue)
            finalColIndex++;

        if (type == "add") {
            cards[finalRowIndex][finalColIndex] = `Empty_${emptyIndex}`;
            allTabs.push(`Empty_${emptyIndex}`);
            emptyIndex++;
            if (rowIndex != finalRowIndex && finalRowIndex == rowBound) {
                for (let i = 0; i < colBound; i++) {
                    if (cards[finalRowIndex][i] == undefined) {
                        cards[finalRowIndex][i] = `Empty_${emptyIndex}`;
                        allTabs.push(`Empty_${emptyIndex}`);
                        emptyIndex++;
                    }
                }
            }
            if (colIndex != finalColIndex && finalColIndex == colBound) {
                for (let i = 0; i < rowBound; i++) {
                    console.log(`${i}, ${finalColIndex}`);
                    if (cards[i][finalColIndex] == undefined) {
                        cards[i][finalColIndex] = `Empty_${emptyIndex}`;
                        allTabs.push(`Empty_${emptyIndex}`);
                        emptyIndex++;
                    }
                }
            }
        }
        else if (type == "reset" && !cards[rowIndex][colIndex]?.includes("Empty")) {
            cards[rowIndex][colIndex] = `Empty_${emptyIndex}`;
            allTabs.push(`Empty_${emptyIndex}`);
        }
        else if (type == "merge") {
            for (let i = 0; i < cards.length; i++) {
                for (let j = 0; j < cards[i].length; j++) {
                    if (cards[i][j] == initialValue) {
                        cards[i][j] = cards[finalRowIndex][finalColIndex];
                    }
                }
            }
        }
        setCards([...cards]);
    }

    const heights: { [key: number]: string } = {
        1: "h-[100vh]",
        2: "h-[100vh]",
        3: "h-[150vh]",
        4: "h-[200vh]",
        5: "h-[250vh]",
    };

    const gridRows: { [key: number]: string } = {
        1: "grid-rows-1",
        2: "grid-rows-2",
        3: "grid-rows-3",
        4: "grid-rows-4",
        5: "grid-rows-5",
    };

    const gridCols: { [key: number]: string } = {
        1: "grid-cols-1",
        2: "grid-cols-2",
        3: "grid-cols-3",
    };

    const rowSpans: { [key: number]: string } = {
        1: "row-span-1",
        2: "row-span-2",
        3: "row-span-3",
        4: "row-span-4",
        5: "row-span-5",
    };

    const colSpans: { [key: number]: string } = {
        1: "col-span-1",
        2: "col-span-2",
        3: "col-span-3",
    };

    return (
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
                            rowIndex={rowIndex}
                            colIndex={colIndex}
                            rowSize={row}
                            colSize={col}
                            rowBound={rowBound}
                            colBound={colBound}
                            cards={cards}
                            cardList={cardList}
                            allTabs={allTabs}
                            setCards={setCards}
                            updateCards={updateCards}
                        />
                    </div>);
                })
            }
        </div>
    )
};

export default CardGrid;
