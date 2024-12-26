import { CardProps } from "@/types/evals/grid";

export const getTabsAndBounds = (cards: (string | undefined)[][]) => {
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
    return { allTabs, cardList, rowBound, colBound };
};

export const getInitialCards = (tab: string) => {
    return Array.from({ length: 5 }, (_, index: number) => (
        index == 0 ? [tab, ...Array(2).fill(undefined)] : Array(3).fill(undefined)
    ));
};

export const replaceCards = (
    cards: (string | undefined)[][],
    initialValue: string | undefined,
    finalValue: string | undefined
) => {
    for (let i = 0; i < cards.length; i++) {
        for (let j = 0; j < cards[i].length; j++) {
            if (cards[i][j] == initialValue) {
                cards[i][j] = finalValue;
            }
        }
    }
    return cards;
}

export const performOperation = (
    allTabs: string[],
    cards: (string | undefined)[][],
    rowBound: number,
    colBound: number,
    rowIndex: number,
    colIndex: number,
    side: "left" | "right" | "top" | "bottom",
    type: "add" | "reset" | "merge"
) => {
    const initialValue = cards[rowIndex][colIndex];
    let newRowIndex = rowIndex, newColIndex = colIndex;

    const lastTab = allTabs.sort(
        (a, b) => parseInt(a.split("_")[1]) - parseInt(b.split("_")[1])
    ).findLast((tab) => tab.includes("Empty"));
    let emptyIndex = lastTab ? parseInt(lastTab?.split("_")[1]) + 1 : 1;

    let finalRowIndex = newRowIndex, finalColIndex = newColIndex;
    while (cards[finalRowIndex][finalColIndex] == initialValue)
        side == "top" ? finalRowIndex-- : finalRowIndex++;
    if (finalRowIndex != newRowIndex)
        side == "top" ? finalRowIndex++ : finalRowIndex--;
    while (cards[finalRowIndex][finalColIndex] == initialValue)
        side == "left" ? finalColIndex-- : finalColIndex++;
    if (finalColIndex != newColIndex)
        side == "left" ? finalColIndex++ : finalColIndex--;

    if (side == "left")
        finalColIndex--;
    else if (side == "right")
        finalColIndex++;
    else if (side == "top")
        finalRowIndex--;
    else
        finalRowIndex++;

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
        const finalValue = cards[finalRowIndex][finalColIndex];
        for (let i = 0; i < cards.length; i++) {
            for (let j = 0; j < cards[i].length; j++) {
                if (cards[i][j] == finalValue)
                    cards[i][j] = initialValue;
            }
        }
        cards = replaceCards(cards, finalValue, initialValue);
    }
    return cards;
};

export const getMerge = (
    side: string,
    cards: (string | undefined)[][],
    cardList: CardProps[],
    rowIndex: number,
    colIndex: number,
    rowSize: number,
    colSize: number,
    rowBound: number,
    colBound: number,
) => {
    let canMerge = true;
    if (side == "left") {
        colIndex--;
        canMerge = colIndex >= 0;
    }
    else if (side == "right") {
        colIndex += colSize;
        canMerge = colIndex < colBound;
    }
    else if (side == "top") {
        rowIndex--;
        canMerge = rowIndex >= 0;
    }
    else {
        rowIndex += rowSize;
        canMerge = rowIndex < rowBound;
    }
    let arrIndex = undefined, index = undefined, size = undefined;
    if (side == "left" || side == "right")
        arrIndex = 0, index = rowIndex, size = rowSize;
    else
        arrIndex = 1, index = colIndex, size = colSize;
    return canMerge && cardList.find(
        (card) => card.tab == cards[rowIndex][colIndex] &&
            card.index[arrIndex] == index
    )?.size[arrIndex] == size;
};
