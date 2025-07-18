"use client";

import ColorPicker from "@/components/Common/Misc/ColorPicker";
import ActionButton from "@/components/Common/Buttons/Action";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useTabUI, useTile } from "@/contexts/hooks";
import { useTabData } from "@/contexts/hooks";
import { Maximize2, EyeOff, CopyPlus, Grip, X, Braces, Grid2x2, Palette, Loader2 } from "lucide-react";
import { Badge } from "@/components/UI/badge";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ContextSelector from "../Blocks/Table/Content/ContextSelector";
import TileInfoPalette from "./TileInfoPalette";
import { LogsActions, ContextActions, CodeActions, GranularTileActions, GranularTabActions, ProjectsActions, FieldsActions } from "@/types/interfaces/grid";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { getTileHeaderRef } from '@/utils/interfaces/refRegistry';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";
import { resolveColorHierarchy } from "@/utils/interfaces/plots/common";
import { useState, useMemo } from "react";

const TileHeader = ({tileId, tabId, interfaceId, projectId, tabActions, tileActions, logsActions, contextActions, projectsActions, fieldsActions}: {
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId:string;
    tabActions: GranularTabActions;
    tileActions: GranularTileActions;
    logsActions: LogsActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    projectsActions: ProjectsActions;
    fieldsActions: FieldsActions;
}) => {
    const { meta: tileMetaState, data: tileDataState, ui: tileUIState} = useTile(tileId, tabId);
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabId);
    const { data: tabDataState} = useTabData(tabId, interfaceId);
    
    // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
    const syncedTabDataActions = syncedTabActions?.data ?? null;

    // SYNCHRONISED TILE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTileActions } = useTileSync(
        tileId, tabId, tileActions,
        projectsActions,
        contextActions,
        logsActions,
        fieldsActions
    );
    const syncedTileUIActions = syncedTileActions?.ui ?? null;

    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));
    const disabled = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

    const setFocusPaneOpen = useStoreContext(state => state.setFocusPaneOpen);

    // Get the header ref from our registry
    const headerRef = getTileHeaderRef(tileId);

    const tileType = tileMetaState?.type ?? undefined;
    const tileName = tileMetaState?.name;
    const tableName = tileDataState?.table;
    const context = tileDataState?.context;
    const columnContext = tileDataState?.column_context;

    // Get table names for linking
    const tableNames = syncedTabDataActions?.getTileNamesByType?.("Table")?.filter(Boolean) as string[] || [];

    // Track popover state to keep tile name visible
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    
    // Dialog state for tile deletion
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    
    // Function to handle tile deletion
    const handleDeleteTile = async () => {
        if (syncedTabDataActions?.removeTile) {
            await syncedTabDataActions.removeTile(tileId);
            return { info: "Tile deleted successfully" };
        }
        throw new Error("Failed to delete tile");
    };

    const handleClone = () => {
        if (tileName && syncedTabDataActions) {
            const allItems = syncedTabDataActions.getItems();
            let cloneIndex = 1;
            let newTileName: string;
            
            // Find a unique name for the clone
            do {
                newTileName = `${tileName}_copy_${cloneIndex}`;
                cloneIndex++;
            } while (allItems.some((item: any) => item.name === newTileName));

            // Use the pasteCopiedTile action which copies a tile's data to a new tile
            syncedTabDataActions.pasteCopiedTile(newTileName, tileName);
        }
    };

    // Helper to truncate nested paths for display
    const truncatePath = (path: string | undefined): string => {
        if (!path) return "";
        const parts = path.split('/');
        if (parts.length > 2) {
            return `${parts[0]}/.../${parts[parts.length - 1]}`;
        }
        return path;
    };

    // Grab interface primary to support hierarchy fallback
    const interfacePrimary = useMemo(() => {
        if (typeof window === 'undefined') return '#2a862a';
        const el = document.querySelector('[data-interface-color]') as HTMLElement | null;
        if (el) {
            const col = getComputedStyle(el).getPropertyValue('--primary').trim();
            return col || '#2a862a';
        }
        return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    }, []);

    return (
        <header ref={headerRef} className={"group/header relative flex w-full h-12 min-h-[3rem] items-center border-b bg-card py-1 px-2 overflow-x-auto command-scrollbar"}>
            {/* Left part: Name, context, etc. */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <TileInfoPalette
                    tileId={tileId}
                    tabId={tabId}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    tileName={tileName}
                    tileType={tileType}
                    linkedTable={tableName || undefined}
                    tableNames={tableNames}
                    syncedTabDataActions={syncedTabDataActions}
                    syncedTileDataActions={syncedTileActions?.data}
                    syncedTileMetaActions={syncedTileActions?.meta}
                    syncedTableTileActions={syncedTileActions?.tableTileActions}
                    tabUIActions={tabUIActions}
                    isEditMode={tabUIState?.edit || false}
                    onOpenChange={setIsPopoverOpen}
                >
                    <div
                        className="flex-shrink-0 cursor-pointer rounded px-2 py-1 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
                    >
                        {tileName}{tileUIState?.loading && <Loader2 className="animate-spin ml-2 inline-block" size={16} />}
                    </div>
                </TileInfoPalette>
                {context && tileType == "Table" && <ContextSelector
                    tileId={tileId}
                    tabId={tabId}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    context={tabDataState?.globalContext}
                    logsActions={logsActions}
                    contextActions={contextActions}
                    button={
                        <Tooltip content={`Context: ${context}`}>
                            <Badge variant="primary" className="flex max-w-[150px] gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                <Braces size={16} />
                                <span className="truncate">{truncatePath(context)}</span>
                            </Badge>
                        </Tooltip>
                    }
                    setPending={tabUIActions.setPending}
                    tileActions={tileActions}
                    projectsActions={projectsActions}
                    fieldsActions={fieldsActions}
                />}
                {(columnContext) && tileType == "Table" && <ContextSelector
                    tileId={tileId}
                    tabId={tabId}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    context={tabDataState?.globalContext}
                    logsActions={logsActions}
                    contextActions={contextActions}
                    button={<Tooltip content={`Column context: ${columnContext}`}>
                        <Badge variant="primary" className="flex max-w-[150px] gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                            <Grid2x2 size={16} />
                            <span className="truncate">{truncatePath(columnContext)}</span>
                        </Badge>
                    </Tooltip>}
                    setPending={tabUIActions.setPending}
                    tileActions={tileActions}
                    projectsActions={projectsActions}
                    fieldsActions={fieldsActions}
                />}
            </div>

            {/* Right part: Action buttons */}
            <div 
                className={`flex items-center gap-1 ml-auto pl-4 flex-shrink-0 transition-opacity duration-200 ${tabUIState?.edit ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}
            >
                {!tabUIState?.edit && (
                <ActionButton
                    className="cursor-pointer"
                    onClick={() => {
                        const focusedTileNames = tabUIState?.focusedTileNames || [undefined, undefined];
                        if (!focusedTileNames.includes(tileName)) {
                            tabUIActions?.setFocusedTileNames([tileName, focusedTileNames[0] || focusedTileNames[1]] as [string | undefined, string | undefined]);
                        }
                        setFocusPaneOpen(true);
                    }}
                    icon={<Maximize2 />}
                    tooltip="Open in focus pane"
                    variant={(tabUIState?.focusedTileNames || [undefined, undefined]).includes(tileName) ? "primary" : "ghost"}
                    size="icon"
                />
                )}
                
                {tabUIState?.edit && (
                    <>
                        <ActionButton
                            className="cursor-pointer"
                            onClick={() => syncedTileUIActions?.setVisible(false)}
                            icon={<EyeOff />}
                            tooltip={"Hide"}
                            variant="ghost"
                            size="icon"
                        />
                        <ActionButton
                            className="cursor-pointer"
                            onClick={handleClone}
                            icon={<CopyPlus />}
                            tooltip={"Copy"}
                            variant="ghost"
                            size="icon"
                        />
                        <ColorPicker
                            value={resolveColorHierarchy(tileUIState?.color, tabUIState?.color, interfacePrimary)}
                            onChange={(color) => syncedTileUIActions?.setColor(color)}
                            useDialog={true}
                            showReset={true}
                            onReset={() => syncedTileUIActions?.setColor(undefined)}
                        >
                            <ActionButton 
                                className="cursor-pointer"
                                icon={<Palette/>} 
                                variant="ghost" 
                                tooltip="Change tile primary color"
                                size="icon"
                            />
                        </ColorPicker>
                        <ActionButton
                            className="drag cursor-grab"
                            disabled={disabled}
                            icon={<Grip />}
                            tooltip="Drag"
                            variant="ghost"
                            size="icon"
                        />
                        <ActionButton
                            className="remove cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            disabled={disabled}
                            onClick={() => setShowDeleteDialog(true)}
                            icon={<X />}
                            tooltip="Remove"
                            variant="ghost"
                            size="icon"
                        />
                    </>
                )}
            </div>
            
            <DeleteDialog
                args={[tileId, tabId, tileName || ""]}
                type={`tile`}
                deletingFunction={handleDeleteTile}
                showDialog={showDeleteDialog}
                setShowDialog={setShowDeleteDialog}
                onDelete={() => {}}
            />
        </header>
    )
}
export default TileHeader;