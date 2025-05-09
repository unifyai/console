"use client";

import { useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import { useTab } from "@/contexts/hooks/tab";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";

const EditTileName = ({
    tabId,
    interfaceId,
}: {
    tabId: string,
    interfaceId: string,
}) => {
    const [newTileName, setNewTileName] = useState<string>();

    const { ui: tabUIState, dataActions: tabDataActions, uiActions: tabUIActions } = useTab(tabId, interfaceId);
    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));
    const readOnly = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

    // edit tile name
    const saveTileName = () => {
        if (newTileName && tabUIState?.editTile && tabDataActions) {
            // Use the new renameTile method which handles both
            // updating the tile name and updating references
            tabDataActions.renameTile(tabUIState?.editTile, newTileName);
        }
        tabUIActions?.setEditTile(undefined);
        setNewTileName(undefined);
    };

    return (
        <Dialog open={true} onOpenChange={() => {
            tabUIActions?.setEditTile(undefined);
            setNewTileName(undefined);
        }}>
            <DialogContent className="w-72">
                <div className="mt-6 flex flex-col gap-2">
                    {readOnly && <div className="text-sm text-muted-foreground">Please wait while tiles are loading...</div>}
                    <div className="flex gap-2">
                        <Input
                            placeholder={readOnly ? tabUIState?.editTile : "Enter new tile name..."}
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
