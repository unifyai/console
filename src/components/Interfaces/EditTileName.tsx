"use client";

import { Dispatch, SetStateAction, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import { useTab } from "@/contexts/hooks/useTab";

const EditTileName = ({
    tabId,
    editTile,
    setEditTile,
}: {
    tabId: string,
    editTile: string | undefined,
    setEditTile: Dispatch<SetStateAction<string | undefined>>,
}) => {
    const [newTileName, setNewTileName] = useState<string>();

    const { actions: tabActions } = useTab(tabId);

    // edit tile name
    const saveTileName = () => {
        if (newTileName && editTile && tabActions) {
            // Use the new renameTile method which handles both
            // updating the tile name and updating references
            tabActions.renameTile(editTile, newTileName);
        }
        setEditTile(undefined);
        setNewTileName(undefined);
    };

    return (
        <Dialog open={true} onOpenChange={() => {
            setEditTile(undefined);
            setNewTileName(undefined);
        }}>
            <DialogContent className="w-72">
                <div className="mt-6 flex gap-2">
                    <Input
                        placeholder={"Enter new tile name..."}
                        value={newTileName || ""}
                        onInput={(input) => setNewTileName(input.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                saveTileName();
                            }
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
