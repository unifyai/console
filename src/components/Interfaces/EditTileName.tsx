"use client";

import { Dispatch, SetStateAction, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import { useTab } from "@/contexts/hooks/tab";
import { useTileUI } from "@/contexts/hooks/tile";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useInterfaceUI } from "@/contexts/hooks/interface";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";

const EditTileName = ({
    tabId,
    interfaceId,
    editTile,
    setEditTile,
}: {
    tabId: string,
    interfaceId: string,
    editTile: string | undefined,
    setEditTile: Dispatch<SetStateAction<string | undefined>>,
}) => {
    const [newTileName, setNewTileName] = useState<string>();

    const { ui: interfaceUIState } = useInterfaceUI(interfaceId);
    const { ui: tabUIState, dataActions: tabDataActions } = useTab(tabId);
    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));
    const readOnly = interfaceUIState?.pending || tabUIState?.resetting || anyTileLoading;

    // edit tile name
    const saveTileName = () => {
        if (newTileName && editTile && tabDataActions) {
            // Use the new renameTile method which handles both
            // updating the tile name and updating references
            tabDataActions.renameTile(editTile, newTileName);
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
                <div className="mt-6 flex flex-col gap-2">
                    {readOnly && <div className="text-sm text-muted-foreground">Please wait while tiles are loading...</div>}
                    <div className="flex gap-2">
                        <Input
                            placeholder={readOnly ? editTile : "Enter new tile name..."}
                            value={newTileName || ""}
                            onInput={(input) => setNewTileName(input.currentTarget.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    saveTileName();
                                }
                            }}
                            readOnly={readOnly}
                            className="h-8 w-48"
                        />
                        <ActionButton
                            className="remove cursor-pointer"
                            onClick={() => saveTileName()}
                            text="Save"
                            tooltip="Save"
                            variant="primary"
                            disabled={readOnly}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EditTileName;
