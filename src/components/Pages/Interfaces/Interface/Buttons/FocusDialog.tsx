"use client";

import { useMemo, useState } from "react";
import { ScrollArea } from "../../../../UI/scroll-area";
import ActionButton from "../../../../Common/Buttons/Action";
import BaseDropdown from "../../../../Common/Dropdowns/Base";
import { Badge } from "../../../../UI/badge";
import { DropdownMenuItem } from "../../../../UI/dropdown-menu";
import { DerivedEntryActions, LogsActions, FieldsActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions, GranularTabActions } from "@/types/interfaces/grid";
import { Plus, X } from "lucide-react";
import { icons } from "@/constants/logs";
import TileCard from "../../Tile/TileCard";
import { useTab } from "@/contexts/hooks/tab";
import { useStoreApiContext, useStoreContext } from "@/contexts/providers/StoreProvider";
import { selectTilesForTab } from "@/contexts/selectors/tile";
import { Tile } from "@/contexts/slices/selectors/tile";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../../../../UI/resizable";

const FocusDialog = ({
    tabIdOrName,
    interfaceId,
    projectId,
    tileActions,
    tabActions,
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
    tabActions: GranularTabActions,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    codeActions: CodeActions,
    projectsActions: ProjectsActions,
    fileActions: FileActions,
}) => {
    const { meta: tabMetaState, ui: tabUIState, uiActions: tabUIActions } = useTab(tabIdOrName, interfaceId);
    const tabId = tabMetaState?.id || "";

    const storeApi = useStoreApiContext();
    const state = storeApi.getState();
    const tiles = selectTilesForTab(state, tabId);

    const firstFocusedTileName = tabUIState?.focusedTileNames ? Array.from(tabUIState.focusedTileNames)[0] : undefined;
    const initialFocusedTile = tiles.find(t => t.name === firstFocusedTileName);
    const [focusedTiles, setFocusedTiles] = useState<Array<Tile | undefined>>(initialFocusedTile ? [initialFocusedTile] : []);

    const setFocusPaneOpen = useStoreContext((state) => state.setFocusPaneOpen);

    const handleAddSplit = () => {
        if (focusedTiles.length >= 4) return;
        setFocusedTiles([...focusedTiles, undefined]);
    };

    const handleRemoveTile = (idx: number) => {
        const newTiles = [...focusedTiles];
        newTiles.splice(idx, 1);
        setFocusedTiles(newTiles);
        if (idx === 0) {
            // keep global state in sync for highlighting logic
            tabUIActions?.setFocusedTileNames([undefined, undefined]);
        }
        if (newTiles.length === 0) {
            setFocusPaneOpen(false);
        }
    };

    const handleSelectTile = (tile: Tile, idx: number) => {
        const newTiles = [...focusedTiles];
        newTiles[idx] = tile;
        setFocusedTiles(newTiles);
        if (idx === 0) {
            tabUIActions?.setFocusedTileNames([tile.name, undefined]);
        }
    };

    const availableTiles = tiles.filter(t => !focusedTiles.map(ft => ft?.name).includes(t.name));

    const TileSlot = (tile: Tile | undefined, idx: number) => (
        tile ? (
            <div className="w-full h-full relative p-2 box-border flex flex-col">
                <TileCard
                    tileId={tile.id}
                    tabId={tabMetaState?.id || ""}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    tileActions={tileActions}
                    tabActions={tabActions}
                    logsActions={logsActions}
                    fieldsActions={fieldsActions}
                    derivedEntryActions={derivedEntryActions}
                    contextActions={contextActions}
                    codeActions={codeActions}
                    fileActions={fileActions}
                    projectsActions={projectsActions}
                />
                <div className="absolute top-3 right-3 z-10">
                    <ActionButton
                        tooltip="Remove split"
                        icon={<X />}
                        variant="outline"
                        onClick={() => handleRemoveTile(idx)}
                    />
                </div>
            </div>
        ) : (
            <div className="h-full w-full flex items-center justify-center p-2">
                <BaseDropdown
                    button={<ActionButton tooltip="Select tile" icon={<Plus />} variant="outline" size="default" />}
                >
                    {availableTiles.map((t, i) => (
                        <DropdownMenuItem key={i} onSelect={() => handleSelectTile(t, idx)} className="w-64 flex justify-between items-center">
                            <span>{t.name}</span>{t.type ? icons[t.type as keyof typeof icons] : ""}
                        </DropdownMenuItem>
                    ))}
                </BaseDropdown>
            </div>
        )
    );

    const PanelContent = (tile: Tile | undefined, idx: number) => (
        <div className="w-full h-full overflow-hidden">
            {TileSlot(tile, idx)}
        </div>
    );

    const renderPanels = () => {
        const count = focusedTiles.length;
        if (count === 1) return (
            <div className="w-full h-full overflow-hidden">
                {PanelContent(focusedTiles[0], 0)}
            </div>
        );
        if (count === 2) return (
            <ResizablePanelGroup direction="horizontal" className="w-full h-full gap-1 min-w-0 min-h-0">
                <ResizablePanel minSize={20}>{PanelContent(focusedTiles[0], 0)}</ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel minSize={20}>{PanelContent(focusedTiles[1], 1)}</ResizablePanel>
            </ResizablePanelGroup>
        );
        if (count === 3) return (
            <ResizablePanelGroup direction="horizontal" className="w-full h-full gap-1 min-w-0 min-h-0">
                <ResizablePanel minSize={20}>{PanelContent(focusedTiles[0], 0)}</ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel minSize={20}>
                    <ResizablePanelGroup direction="vertical" className="h-full gap-1 min-w-0 min-h-0">
                        <ResizablePanel minSize={20}>{PanelContent(focusedTiles[1], 1)}</ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel minSize={20}>{PanelContent(focusedTiles[2], 2)}</ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        );
        if (count >= 4) return (
            <ResizablePanelGroup direction="vertical" className="w-full h-full gap-1 min-w-0 min-h-0">
                <ResizablePanel minSize={20}>
                    <ResizablePanelGroup direction="horizontal" className="h-full gap-1 min-w-0 min-h-0">
                        <ResizablePanel minSize={20}>{PanelContent(focusedTiles[0], 0)}</ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel minSize={20}>{PanelContent(focusedTiles[1], 1)}</ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel minSize={20}>
                    <ResizablePanelGroup direction="horizontal" className="h-full gap-1 min-w-0 min-h-0">
                        <ResizablePanel minSize={20}>{PanelContent(focusedTiles[2], 2)}</ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel minSize={20}>{PanelContent(focusedTiles[3], 3)}</ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        );
        return null;
    };

    return (
        <div className="w-full h-full flex flex-col box-border">
            {/* Toolbar */}
            <div className="flex items-center gap-4 p-2 border-b bg-background/80">
                <h2 className="text-lg font-semibold">Focus Mode</h2>
                <ActionButton
                    tooltip="Add split screen"
                    icon={<Plus />}
                    variant="outline"
                    onClick={handleAddSplit}
                    disabled={focusedTiles.length >= 4}
                />
                {/* <ActionButton
                    tooltip="Close focus mode"
                    icon={<X />}
                    variant="ghost"
                    onClick={() => setFocusPaneOpen(false)}
                /> */}
            </div>
            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {renderPanels()}
            </div>
        </div>
    );
};

export default FocusDialog;
