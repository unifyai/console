"use client";

import { useMemo } from "react";
import { DoublePanels } from "../../../../Common/Body/DoublePanels";
import { ScrollArea } from "../../../../UI/scroll-area";
import ActionButton from "../../../../Common/Buttons/Action";
import BaseDropdown from "../../../../Common/Dropdowns/Base";
import { Badge } from "../../../../UI/badge";
import { DropdownMenuItem } from "../../../../UI/dropdown-menu";
import { DerivedEntryActions, LogsActions, FieldsActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions } from "@/types/interfaces/grid";
import { Plus, X } from "lucide-react";
import { icons } from "@/constants/logs";
import TileCard from "../../Tile/TileCard";
import { useTab } from "@/contexts/hooks/tab";
import { useStoreApiContext, useStoreContext } from "@/contexts/providers/StoreProvider";
import { selectTilesForTab } from "@/contexts/selectors/tile";
import { Tile } from "@/contexts/slices/selectors/tile";

const FocusDialog = ({
    tabIdOrName,
    interfaceId,
    projectId,
    tileActions,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions,
    codeActions,
    projectsActions,
    fileActions,
}: {
    tabIdOrName: string;
    interfaceId: string;
    projectId: string;
    tileActions: GranularTileActions,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    codeActions: CodeActions,
    projectsActions: ProjectsActions,
    fileActions: FileActions,
}) => {
    const { meta: tabMetaState, ui: tabUIState, uiActions: tabUIActions, dataActions: tabDataActions } = useTab(tabIdOrName, interfaceId);
    const tabId = tabMetaState?.id || "";

    const storeApi = useStoreApiContext();
    const state = storeApi.getState();
    const tiles = selectTilesForTab(state, tabId);

    const safeFocusedTileNames = useMemo(() => 
        tabUIState?.focusedTileNames ? Array.from(tabUIState.focusedTileNames) : [undefined, undefined], 
        [tabUIState?.focusedTileNames]
    );

    const setFocusPaneOpen = useStoreContext((state) => state.setFocusPaneOpen);

    const focusedTiles: [Tile | undefined, Tile | undefined] = safeFocusedTileNames.map(
        focusedTileName => {
            const index = tiles.findIndex(tile => tile.name === focusedTileName);
            const tile = index !== -1 ? tiles[index] : undefined;
            return index !== -1 ? tile : undefined;
        }
    ) as [Tile | undefined, Tile | undefined];

    const focusedTilesToRender = focusedTiles.map((tile: Tile | undefined, idx: number) => {
        if (!tile) return null;

        return (
            tile
                ? <div className="h-full relative pt-2">
                    <TileCard
                        tileId={tile.id}
                        tabId={tabMetaState?.id || ""}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        tileActions={tileActions}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        codeActions={codeActions}
                        fileActions={fileActions}
                        projectsActions={projectsActions}
                    />
                    <div className={"w-full px-2 transition-all absolute -top-1 flex justify-between " + (tabUIState?.edit ? "h-28" : "h-10")}>
                        <div>
                            <Badge variant="primary">{tile.name}</Badge>
                        </div>
                        <div className="mb-auto">
                            <ActionButton
                                className="remove cursor-pointer hover:z-10"
                                onClick={() => {
                                    const newFocusedTileNames = [...safeFocusedTileNames];
                                    newFocusedTileNames[idx] = undefined;
                                    tabUIActions?.setFocusedTileNames(newFocusedTileNames as [string | undefined, string | undefined]);
                                    if (newFocusedTileNames[0] == undefined && newFocusedTileNames[1] == undefined)
                                        setFocusPaneOpen(false);
                                }}
                                icon={<X />}
                                tooltip="Remove from focus pane"
                                variant="outline"
                            />
                        </div>
                    </div>
                </div>
                : <div className="h-full w-full flex justify-center items-center">
                    <div className="w-fit">
                        <BaseDropdown
                            button={<ActionButton
                                tooltip="Select tile"
                                icon={<Plus />}
                                variant="outline"
                                size="default"
                            />}
                        >
                            {tiles.filter(tile => !safeFocusedTileNames.includes(tile.name)).map((tile, idx_) => <DropdownMenuItem
                                key={idx_}
                                onSelect={() => {
                                    const newFocusedTileNames = [...safeFocusedTileNames];
                                    newFocusedTileNames[idx] = tile.name;
                                    tabUIActions?.setFocusedTileNames(newFocusedTileNames as [string | undefined, string | undefined]);
                                }}
                                className="w-64 flex justify-between items-center"
                            >
                                    <span>{tile.name}</span>{tile.type ? icons[tile.type as keyof typeof icons] : ""}
                            </DropdownMenuItem>)}
                        </BaseDropdown>
                    </div>
                </div>
        );
    });

    return (
        <DoublePanels
            isLoading={false}
            first={<ScrollArea className="h-full"><div className="p-2">{focusedTilesToRender[0]}</div></ScrollArea>}
            second={<ScrollArea className="h-full"><div className="p-2">{focusedTilesToRender[1]}</div></ScrollArea>}
        />
    );
};

export default FocusDialog;
