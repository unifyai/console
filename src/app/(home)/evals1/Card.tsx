"use client";

import { Dispatch, SetStateAction, useState } from "react";
import TileButtons from "./TileButtons";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Plus } from "lucide-react";

const Card = ({ cards, rowIndex, colIndex, setCards, updateCards }: {
    cards: (string | undefined)[][],
    rowIndex: number,
    colIndex: number
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
    return (<div className="relative flex w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="w-full border rounded-lg m-3 p-3 flex transition-all justify-center items-center">
            <div>
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
        </div>
        <div className={"h-full absolute right-5 flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
            <TileButtons
                side="right"
                full={cards[rowIndex].length == 3}
                empty={cards.length == 1 && cards[rowIndex].length == 1}
                onClick={
                    (type: "add" | "remove") => updateCards(rowIndex, colIndex, "right", type)
                }
            />
        </div>
        <div className={"h-full absolute left-5 flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
            <TileButtons
                side="left"
                full={cards[rowIndex].length == 3}
                empty={cards.length == 1 && cards[rowIndex].length == 1}
                onClick={
                    (type: "add" | "remove") => updateCards(rowIndex, colIndex, "left", type)
                }
            />
        </div>
        <div className={"w-full absolute top-5 flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
            <TileButtons
                side="top"
                full={false}
                empty={cards.length == 1 && cards[rowIndex].length == 1}
                onClick={
                    (type: "add" | "remove") => updateCards(rowIndex, colIndex, "top", type)
                }
            />
        </div>
        <div className={"w-full absolute bottom-5 flex gap-3 items-center transition-all hover:opacity-100 " + (hovered ? "opacity-50" : "opacity-0")}>
            <TileButtons
                side="bottom"
                full={false}
                empty={cards.length == 1 && cards[rowIndex].length == 1}
                onClick={
                    (type: "add" | "remove") => updateCards(rowIndex, colIndex, "bottom", type)
                }
            />
        </div>
    </div>)
};

export default Card;
