"use client";

import { useState } from "react";
import Card from "./Card";

const Main = () => {
    const [cards, setCards] = useState<(string | undefined)[][]>([[undefined]]);

    const updateCards = (
        rowIndex: number,
        colIndex: number,
        side: "left" | "right" | "top" | "bottom",
        type: "add" | "remove"
    ) => {
        const leftOrRight = side == "left" || side == "right";
        console.log(`${rowIndex} ${colIndex}`);
        if (type == "add") {
            if (leftOrRight && cards[rowIndex].length < 3) {
                if (side == "left")
                    cards[rowIndex].splice(colIndex, 0, undefined);
                else
                    cards[rowIndex].splice(colIndex + 1, 0, undefined);
                console.dir(cards[rowIndex]);
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
            {cards.map((cardList, index) => (
                <div className={`flex-col w-full ${cards.length == 1 ? "h-full" : "h-1/2"}`} key={index}>
                    <div className="relative flex w-full h-full">
                        {cardList.map((_, subIndex) => (
                            <Card
                                key={`${index}_${subIndex}`}
                                rowIndex={index}
                                colIndex={subIndex}
                                cards={cards}
                                setCards={setCards}
                                updateCards={updateCards}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Main;
