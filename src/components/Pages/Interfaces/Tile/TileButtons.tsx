"use client";

import ColorPicker from "../../../Common/Misc/ColorPicker";
import ActionButton from "../../../Common/Buttons/Action";
import DeleteDialog from "../../../Common/Dialogs/Delete";
import { useTabUI, useTile } from "@/contexts/hooks";
import { useTabData } from "@/contexts/hooks";
import { Maximize2, EyeOff, Copy, Grip, X, Braces, Grid2x2, Palette, Loader2 } from "lucide-react";
import { Badge } from "../../../UI/badge";
import Tooltip from "../../../Common/Misc/Tooltip";
import ContextSelector from "../Blocks/Table/Content/ContextSelector";
import TileInfoPalette from "./TileInfoPalette";
import { LogsActions, ContextActions, CodeActions, GranularTileActions, GranularTabActions, ProjectsActions, FieldsActions } from "@/types/interfaces/grid";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { getTileButtonsRef } from '@/utils/refRegistry';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";
import { resolveColorHierarchy } from "@/utils/interfaces/plots/common";
import { useState } from "react";

const TileButtons = ({tileId, tabId, interfaceId, projectId, tabActions, tileActions, logsActions, contextActions, projectsActions, fieldsActions}: {
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

    // Get the buttons ref from our registry
    const buttonsRef = getTileButtonsRef(tileId);

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

    return (
        <div ref={buttonsRef} className={"w-full px-2 transition-all absolute top-2 flex justify-between z-50 pointer-events-none " + (tabUIState?.edit ? "h-24" : "h-10")}>
            {/* Only show tile name and context info in edit mode */}
            {tabUIState?.edit && (
                <div className="flex gap-2 mb-auto ml-1 items-center z-10 relative pointer-events-auto transition-opacity duration-200 opacity-100">
                    {/* Tile name with info popover */}
                    <TileInfoPalette
                        tileId={tileId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        tileName={tileName}
                        tileType={tileType}
                        linkedTable={tableName || undefined}
                        tableNames={tableNames}
                        syncedTileDataActions={syncedTileActions?.data}
                        syncedTileMetaActions={syncedTileActions?.meta}
                        syncedTableTileActions={syncedTileActions?.tableTileActions}
                        tabUIActions={tabUIActions}
                        isEditMode={tabUIState?.edit || false}
                        onOpenChange={setIsPopoverOpen}
                    >
                        <div
                            className="cursor-pointer text-sm font-normal mb-1 flex gap-2 items-center bg-background/95 backdrop-blur-sm border border-border/50 rounded px-2 py-1 text-[color:var(--foreground)] transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            {tileName}{tileUIState?.loading && <Loader2 className="animate-spin" size={16} />}
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
                            <Tooltip content="Context">
                                <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                    <Braces size={18} />
                                    {context}
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
                        button={<Tooltip content="Column context">
                            <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                <Grid2x2 size={18} />
                                {columnContext}
                            </Badge>
                        </Tooltip>}
                        setPending={tabUIActions.setPending}
                        tileActions={tileActions}
                        projectsActions={projectsActions}
                        fieldsActions={fieldsActions}
                    />}
                </div>
            )}

            <div 
                className={`flex-1 flex justify-end gap-2 mb-auto transition-opacity duration-200 pointer-events-auto scale-75 origin-top-right ${tabUIState?.edit ? 'opacity-100' : 'opacity-0 tile-action-buttons'}`}
            >
                {/* Focus pane button - only show in non-edit mode on hover */}
                {!tabUIState?.edit && (
                <ActionButton
                    className="cursor-pointer backdrop-blur-sm bg-background/90 shadow-md"
                    onClick={() => {
                        const focusedTileNames = tabUIState?.focusedTileNames || [undefined, undefined];
                        if (!focusedTileNames.includes(tileName)) {
                            tabUIActions?.setFocusedTileNames([tileName, focusedTileNames[0] || focusedTileNames[1]] as [string | undefined, string | undefined]);
                        }
                        setFocusPaneOpen(true);
                    }}
                    icon={<Maximize2 />}
                    tooltip="Open in focus pane"
                    variant={(tabUIState?.focusedTileNames || [undefined, undefined]).includes(tileName) ? "primary" : "outline"}
                    size="icon"
                />
                )}
                
                {/* Edit-specific buttons - only show in edit mode */}
                {tabUIState?.edit && (
                    <>
                        <ActionButton
                            className="cursor-pointer backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                            onClick={() => syncedTileUIActions?.setVisible(false)}
                            icon={<EyeOff />}
                            tooltip={"Hide"}
                            variant="outline"
                            size="icon"
                        />
                        <ActionButton
                            className="cursor-pointer backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                            onClick={() => tabUIActions?.setCopied(tileName)}
                            icon={<Copy />}
                            tooltip={"Copy"}
                            variant="outline"
                            size="icon"
                        />
                        <ColorPicker
                            value={resolveColorHierarchy(tileUIState?.color, tabUIState?.color)}
                            onChange={(color) => syncedTileUIActions?.setColor(color)}
                            useDialog={true}
                            showReset={true}
                            onReset={() => syncedTileUIActions?.setColor(undefined)}
                        >
                            <ActionButton 
                                className="cursor-pointer backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                                icon={<Palette/>} 
                                variant="outline" 
                                tooltip="Change tile primary color"
                                size="icon"
                            />
                        </ColorPicker>
                        <ActionButton
                            className="drag cursor-grab backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                            disabled={disabled}
                            icon={<Grip />}
                            tooltip="Drag"
                            variant="outline"
                            size="icon"
                        />
                        <ActionButton
                            className="remove cursor-pointer backdrop-blur-sm bg-background/90 border border-border/50 shadow-md hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                            disabled={disabled}
                            onClick={() => setShowDeleteDialog(true)}
                            icon={<X />}
                            tooltip="Remove"
                            variant="outline"
                            size="icon"
                        />
                    </>
                )}
            </div>
            
            {/* Delete confirmation dialog */}
            <DeleteDialog
                args={[tileId, tabId, tileName || ""]}
                type={`tile`}
                deletingFunction={handleDeleteTile}
                showDialog={showDeleteDialog}
                setShowDialog={setShowDeleteDialog}
                onDelete={() => {
                    // Dialog will auto-close after successful deletion
                }}
            />
        </div>
    )
}
export default TileButtons;