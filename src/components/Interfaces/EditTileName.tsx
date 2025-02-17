"use client";

import { Dispatch, SetStateAction, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import { TileProps } from "@/types/evals/grid";

const EditTileName = ({
    items,
    editTile,
    setItems,
    setEditTile
}: {
    items: TileProps[],
    editTile: string,
    setItems: Dispatch<SetStateAction<TileProps[]>>,
    setEditTile: Dispatch<SetStateAction<string | undefined>>
}) => {
    const [newTileName, setNewTileName] = useState<string>();

    // edit tile name
    const saveTileName = () => {
        if (newTileName) {
            const newItems = items.map(
                item => (
                    item.i == editTile
                        ? { ...item, i: newTileName }
                        : item.table == editTile
                            ? { ...item, table: newTileName }
                            : { ...item }
                )
            );
            setItems([...newItems]);
        }
        setEditTile(undefined);
        setNewTileName(undefined);
    };

    return (
        <Dialog open={true} onOpenChange={() => {
            setEditTile(undefined);
            setNewTileName(undefined);
        }}>
            <DialogContent className="w-1/6">
                <div className="mt-6 flex gap-2">
                    <Input
                        placeholder={"Enter new tile name..."}
                        value={newTileName || ""}
                        onInput={(input) => setNewTileName(input.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter")
                                saveTileName();
                        }}
                        className="h-8 w-48"
                    />
                    <ActionButton
                        className="remove cursor-pointer"
                        onClick={() => saveTileName()}
                        text="Save"
                        tooltip="Save"
                        variant="primary"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EditTileName;
