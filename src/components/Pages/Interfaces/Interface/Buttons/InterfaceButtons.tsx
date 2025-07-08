"use client";

import { ContextActions, LogsActions, GranularTabActions, GranularTileActions, GranularInterfaceActions, ProjectsActions, FieldsActions } from "@/types/interfaces/grid";
import { Eye, Hammer, SquareMousePointer, Info, Settings, Trash, Pen } from "lucide-react";
import { Check, Clipboard, ListRestart, Loader2, TriangleAlert, Save, FocusIcon, Palette, Plus } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import BaseDialog from "@/components/Common/Dialogs/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/UI/switch";
import { Label } from "@/components/UI/label";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import Tooltip from "@/components/Common/Misc/Tooltip";
import ColorPicker from "@/components/Common/Misc/ColorPicker";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { FileUpload } from "./FileUpload";
import AddTile from "./AddTile";
import ContextSelector from "../../Blocks/Table/Content/ContextSelector";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useEffect, useMemo, useState } from "react";

import { useTab } from "@/contexts/hooks/tab";
import { useTiles } from "@/contexts/hooks/useStore";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { useRestoreLastSavedTabWithTilesQuery } from '@/hooks/Interfaces/Query/useRestoreLastSavedTabWithTilesQuery';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";
import { useInterfaceSync } from "@/contexts/hooks/interface/sync/useInterfaceSync";
import { useListContextsQuery } from "@/hooks/Interfaces/Query/useContextsQuery";
import { showSuccessToast, showErrorToast } from "@/components/Common/Toasts/notifications";
import { resolveColorHierarchy } from "@/utils/interfaces/plots/common";

const InterfaceButtons = ({
    tabIdOrName,
    interfaceId,
    logsActions,
    contextActions,
    tabActions,
    tileActions,
    interfaceActions,
    projectsActions,
    fieldsActions,
    disabled,
}: {
    tabIdOrName: string | null,
    interfaceId: string,
    logsActions: LogsActions,
    contextActions: ContextActions,
    tabActions: GranularTabActions,
    tileActions: GranularTileActions,
    interfaceActions: GranularInterfaceActions,
    projectsActions: ProjectsActions,
    fieldsActions: FieldsActions,
    disabled?: boolean,
}) => {
    const router = useRouter();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    
    // Use hooks for tab operations
    const restoreTabMutation = useRestoreLastSavedTabWithTilesQuery();
    
    // Get the project data and the contexts with granular access
    const storeCommands = useStoreContext((s) => s.commands);
    const project = useStoreContext((state) => state.activeProjectId);
    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));

    // Use React Query to fetch contexts
    const listContextsQuery = useListContextsQuery(project || null, contextActions);
    const contexts = listContextsQuery.data || [];

    // Tab states and actions with granular access
    const {
        meta: tabMetaState,
        data: tabDataState,
        ui: tabUIState,
        dataActions: tabDataActions,
        uiActions: tabUIActions,
    } = useTab(tabIdOrName || "", interfaceId);
    const tabId = tabMetaState?.id || null;
    const tabName = tabMetaState?.name || null;

    // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
    const syncedTabDataActions = syncedTabActions?.data ?? null;
    const syncedTabUIActions = syncedTabActions?.ui ?? null;

    // SYNCHRONISED INTERFACE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedInterfaceActions } = useInterfaceSync(interfaceId, project, interfaceActions, tabActions);
    const syncedInterfaceDataActions = syncedInterfaceActions?.data ?? null;
    const syncedInterfaceUIActions = syncedInterfaceActions?.ui ?? null;

    // Get tileIds from tab data properly
    const tileIds = useMemo(() => tabDataState?.tileIds || [], [tabDataState?.tileIds]);

    // Only subscribe to a subset of the tiles objects to incl. name, type and tableTile only
    const tiles = useTiles(tileIds, ["name", "type", "tableTile"]);

    // Calculate derived state
    const items = useMemo(() => {
        return !tabDataActions ? [] : tabDataActions.getItems();
    }, [tabDataActions]);

    // Get hidden items
    const hiddenItems = items.filter(item => !item.visible);

    const saveIcon = tabUIState?.saveSuccess ? <Check /> : tabUIState?.saveSuccess === false ? <TriangleAlert /> : <Save />;
    const resetIcon = tabUIState?.resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;
    const variant = tabUIState?.saveSuccess === false ? "destructive" : "ghost";

    // Use combined disabled state from prop and other sources
    const isDisabled = disabled || !project || tabUIState?.pending;

    // Handle context change 
    const handleContextChange = (ctx: string) => {
        if (syncedTabDataActions && tabUIActions && project && tabName) {
            // First update the tab's context using synchronized action
            syncedTabDataActions.setGlobalContext(ctx, (pending) => tabUIActions.setDataPending(pending));
            
            // Then update each tile's context-related properties if needed
            tiles.forEach(tile => {
                // Get the corresponding item to check current context
                const item = items.find(i => i.id === tile.id);
                if (item) {
                    const validContext = contexts.some(c => c.name === ctx);
                    const validItemContext = item.context?.startsWith(ctx);
                    const prefixContexts = contexts.filter(c => c.name.startsWith(ctx));

                    // Determine the new context value based on conditions
                    const newContext = validContext
                        ? ctx
                        : validItemContext
                            ? item.context
                            : prefixContexts.length === 1
                                ? prefixContexts[0].name
                                : undefined;

                    // Update the tile's context
                    syncedTabDataActions?.updateTile(tile.id || "", {
                        context: newContext,
                        column_context: validItemContext ? item.column_context : undefined
                    });
                }
            });

        }
    };

    // Handler for pasting tile
    const handlePaste = () => {
        if (tabUIState?.copied && syncedTabDataActions) {
            const newCounter = tileIds.length + 1;
            const newName = "Tile_" + newCounter;
            syncedTabDataActions.pasteCopiedTile(newName, tabUIState.copied);
            tabUIActions?.setCopied(undefined);
        }
    };

    // action tab states
    const fileUploadOpen = useStoreContext((s) => s.fileUploadOpen);
    const globalContextOpen = useStoreContext((s) => s.globalContextOpen);
    const setFileUploadOpen = useStoreContext((s) => s.setFileUploadOpen);
    const setFocusPaneOpen = useStoreContext((s) => s.setFocusPaneOpen);
    const setGlobalContextOpen = useStoreContext((s) => s.setGlobalContextOpen);
    const setSaveInterfaceOpen = useStoreContext((s) => s.setSaveInterfaceOpen);
    const resetInterfaceCommand = storeCommands.find(cmd => cmd.id === "reset-interface");

    // Delete tab state
    const [deleteTabOpen, setDeleteTabOpen] = useState(false);

    // Handle tab deletion
    const handleDeleteTab = async () => {
        if (!tabName || !interfaceId) {
            return { error: "No tab selected for deletion" };
        }
        
        try {
            // If this is the only tab, prevent deletion
            const interfaceData = syncedInterfaceDataActions?.getTabNames() || [];
            if (interfaceData.length <= 1) {
                return { error: "Cannot delete the last remaining tab" };
            }

            // Switch to another tab first
            const tabIdx = interfaceData.indexOf(tabName);
            const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : interfaceData.length > 1 ? 1 : -1;
            const nextTabName = nextTabIdx !== -1 ? interfaceData[nextTabIdx] : null;
            
            // Update active tab before deletion
            if (nextTabName && syncedInterfaceUIActions) {
                syncedInterfaceUIActions.setActiveTab(nextTabName);
            }
            
            // Use synchronized action to remove the tab
            await syncedInterfaceDataActions?.removeTab(tabName);
            
            return { info: `Tab "${tabName}" was successfully deleted.` };
        } catch (error) {
            return { error: "Failed to delete tab. Please try again." };
        }
    };

    // Rename tab state
    const [renameTabOpen, setRenameTabOpen] = useState(false);
    const [newTabName, setNewTabName] = useState("");
    const [renameError, setRenameError] = useState("");

    // Handle tab rename
    const handleRenameTab = async () => {
        if (!tabName || !interfaceId) {
            setRenameError("No tab selected for renaming");
            return;
        }
        
        const trimmedName = newTabName.trim();
        
        // Validation
        if (!trimmedName) {
            setRenameError("Tab name cannot be empty");
            return;
        }
        
        if (trimmedName === tabName) {
            setRenameTabOpen(false);
            setNewTabName("");
            setRenameError("");
            return;
        }
        
        // Check for duplicates (case insensitive)
        const interfaceData = syncedInterfaceDataActions?.getTabNames() || [];
        const duplicate = interfaceData.some(name => 
            name.toLowerCase() === trimmedName.toLowerCase() && 
            name !== tabName
        );
        
        if (duplicate) {
            setRenameError(`A tab called "${trimmedName}" already exists`);
            return;
        }

        try {
            // Use synchronized action to rename the tab
            await syncedInterfaceDataActions?.renameTab(tabName, trimmedName);
            
            showSuccessToast("Tab Renamed", `Tab successfully renamed to "${trimmedName}"`);
            setRenameTabOpen(false);
            setNewTabName("");
            setRenameError("");
        } catch (error) {
            setRenameError("Failed to rename tab. Please try again.");
        }
    };

    // Reset rename dialog when it opens
    useEffect(() => {
        if (renameTabOpen) {
            setNewTabName(tabName || "");
            setRenameError("");
        }
    }, [renameTabOpen, tabName]);

    useEffect(() => {
        if (fileUploadOpen || globalContextOpen || deleteTabOpen || renameTabOpen)
            setDropdownOpen(true);
        else
            setDropdownOpen(false);
    }, [fileUploadOpen, globalContextOpen, deleteTabOpen, renameTabOpen]);

    return (
        <div className="flex items-center gap-2">
            {/* Edit mode buttons - individual buttons when in edit mode */}
            {tabUIState?.edit && (
                <>
                    {/* Save Tab */}
                    <ActionButton
                        className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md animate-in slide-in-from-bottom-2 duration-200"
                        tooltip={!project ? "Select a project first" : "Save Tab"}
                        icon={saveIcon}
                        variant={variant}
                        disabled={isDisabled}
                        onClick={() => setSaveInterfaceOpen(true)}
                    />
                    
                    {/* Reset Tab */}
                    <ActionButton
                        className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md animate-in slide-in-from-bottom-2 duration-200"
                        tooltip={!project ? "Select a project first" : "Reset Tab"}
                        icon={resetIcon}
                        variant="outline"
                        disabled={isDisabled || tabUIState?.resetting}
                        onClick={() => {
                            if (resetInterfaceCommand) {
                                resetInterfaceCommand.action?.();
                            }
                        }}
                    />
                    
                    {/* Add Tile */}
                    <ActionButton
                        className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md animate-in slide-in-from-bottom-2 duration-200"
                        tooltip={(!tabUIState?.edit || !project) ? "Select a project first" : "Add new tile"}
                        icon={<Plus />}
                        variant="outline"
                        disabled={!tabUIState?.edit || !project || tabUIState?.pending || tabUIState?.resetting || anyTileLoading}
                        onClick={() => {
                            // Use the same logic as AddTile but inline
                            const items = syncedTabDataActions?.getItems() || [];
                            const visibleItems = items.filter(item => item.visible);
                            
                            let initialIndex = items.length;
                            while (items.some(item => item.name == "Tile_" + initialIndex))
                                initialIndex++;
                            const newTileName = "Tile_" + initialIndex;

                            // Calculate the best position for the new tile
                            const position = {
                                x: (() => {
                                    // Group items by row
                                    const rowGroups = visibleItems.reduce((acc, item) => {
                                        const row = Math.floor(item.y);
                                        if (!acc[row]) acc[row] = [];
                                        acc[row].push(item);
                                        return acc;
                                    }, {} as Record<number, any[]>);

                                    // Try to find space in existing rows first
                                    const rows = Object.keys(rowGroups).map(Number).sort();
                                    for (const row of rows) {
                                        const rowItems = rowGroups[row];
                                        rowItems.sort((a, b) => a.x - b.x);
                                        
                                        let x = 0;
                                        for (const item of rowItems) {
                                            if (item.x - x >= 4) {
                                                return x;
                                            }
                                            x = item.x + item.w;
                                        }
                                        
                                        if (x <= 8) {
                                            return x;
                                        }
                                    }
                                    return 0;
                                })(),
                                y: (() => {
                                    const rowGroups = visibleItems.reduce((acc, item) => {
                                        const row = Math.floor(item.y);
                                        if (!acc[row]) acc[row] = [];
                                        acc[row].push(item);
                                        return acc;
                                    }, {} as Record<number, any[]>);

                                    const rows = Object.keys(rowGroups).map(Number).sort();
                                    
                                    for (const row of rows) {
                                        const rowItems = rowGroups[row];
                                        const rowSpace = rowItems.reduce((occupied, item) => {
                                            occupied.push({start: item.x, end: item.x + item.w});
                                            return occupied;
                                        }, [] as {start: number, end: number}[]);

                                        let x = 0;
                                        for (const space of rowSpace) {
                                            if (space.start - x >= 4) {
                                                return row;
                                            }
                                            x = space.end;
                                        }
                                        if (x <= 8) {
                                            return row;
                                        }
                                    }
                                    return rows.length ? Math.max(...rows) + 4 : 0;
                                })(),
                                width: 4,
                                height: 4,
                            };

                            syncedTabDataActions?.initTile(newTileName, {
                                position,
                                minW: null,
                                minH: null,
                                type: null,
                                visible: true,
                            });
                        }}
                    />
                    
                    {/* Paste */}
                    <ActionButton
                        className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md animate-in slide-in-from-bottom-2 duration-200"
                        icon={<Clipboard />}
                        variant="outline"
                        tooltip="Paste"
                        disabled={!tabUIState?.copied || isDisabled}
                        onClick={handlePaste}
                    />
                    
                    {/* Change Tab Color */}
                    <ColorPicker
                        value={resolveColorHierarchy(null, tabUIState?.color)}
                        onChange={(color) => syncedTabUIActions?.setColor(color)}
                        useDialog={true}
                        showReset={true}
                        onReset={() => syncedTabUIActions?.setColor(undefined)}
                    >
                        <ActionButton
                            className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md animate-in slide-in-from-bottom-2 duration-200"
                            icon={<Palette />}
                            variant="outline"
                            tooltip="Change Tab Color"
                            disabled={!project}
                        />
                    </ColorPicker>
                </>
            )}
            
            <BaseDropdown
                context="tab"
                button={<ActionButton
                    className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                    tooltip="Tab Settings"
                    icon={<Settings />}
                    variant="outline"
                />}
                className="min-w-0 w-fit"
                open={dropdownOpen}
                setOpen={setDropdownOpen}
            >
                <div className="w-fit flex flex-col items-center p-2">

                    {/* File upload */}
                    <div className="w-full border-b pb-1">
                        <FileUpload
                            contexts={contexts}
                            logsActions={logsActions}
                            project={project}
                            customOpen={fileUploadOpen}
                            setCustomOpen={setFileUploadOpen}
                        />
                    </div>



                    {/* Context selector */}
                    <div className="w-full border-b py-1">
                        <ContextSelector
                            tabId={tabId || undefined}
                            interfaceId={interfaceId}
                            projectId={project || undefined}
                            context={tabDataState?.globalContext}
                            setContext={handleContextChange}
                            customOpen={globalContextOpen}
                            setCustomOpen={setGlobalContextOpen}
                            logsActions={logsActions}
                            contextActions={contextActions}
                            projectsActions={projectsActions}
                            fieldsActions={fieldsActions}
                            setPending={tabUIActions?.setPending!}
                        />
                    </div>

                    {/* Save button - only show in non-edit mode */}
                    {!tabUIState?.edit && (
                    <div className="w-full border-b py-1">
                        <ActionButton
                            className="transition-all"
                            text="Save Tab"
                            tooltip={!project ? "Select a project first" : "Save Tab"}
                            icon={saveIcon}
                            variant={variant}
                            disabled={isDisabled}
                            onClick={() => setSaveInterfaceOpen(true)}
                        />
                    </div>
                    )}

                    {/* Reset button - only show in non-edit mode */}
                    {!tabUIState?.edit && (
                    <div className="w-full border-b py-1">
                        <ActionButton
                            className="transition-all"
                            text="Reset Tab"
                            tooltip={!project ? "Select a project first" : "Reset Tab"}
                            icon={resetIcon}
                            variant="ghost"
                            disabled={isDisabled || tabUIState?.resetting}
                            onClick={() => {
                                if (resetInterfaceCommand) {
                                    resetInterfaceCommand.action?.();
                                }
                            }}
                        />
                    </div>
                    )}

                    {/* Rename button */}
                    <div className="w-full border-b py-1">
                        <BaseDialog
                            button={
                                <ActionButton
                                    className="transition-all"
                                    text="Rename Tab"
                                    tooltip={!project ? "Select a project first" : "Rename Tab"}
                                    icon={<Pen />}
                                    variant="ghost"
                                    disabled={isDisabled}
                                    onClick={() => setRenameTabOpen(true)}
                                />
                            }
                            title="Rename Tab"
                            body={
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="tab-name">Tab Name</Label>
                                        <Input
                                            id="tab-name"
                                            value={newTabName}
                                            onChange={(e) => {
                                                setNewTabName(e.target.value);
                                                if (renameError) setRenameError("");
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleRenameTab();
                                                }
                                            }}
                                            placeholder="Enter tab name"
                                            autoFocus
                                        />
                                        {renameError && (
                                            <p className="text-xs text-destructive mt-1">{renameError}</p>
                                        )}
                                    </div>
                                </div>
                            }
                            footer={
                                <SubmitButton
                                    text="Rename"
                                    onClick={handleRenameTab}
                                    disabled={!newTabName.trim() || newTabName.trim() === tabName}
                                />
                            }
                            open={renameTabOpen}
                            setOpen={setRenameTabOpen}
                        />
                    </div>

                    {/* Delete button */}
                    <div className="w-full border-b py-1">
                        <DeleteDialog
                            type="tab"
                            args={[]}
                            deletingFunction={handleDeleteTab}
                            variant="ghost"
                            text="Delete Tab"
                            customOpen={deleteTabOpen}
                            setCustomOpen={setDeleteTabOpen}
                            onDelete={() => {}}
                            icon={<Trash />}
                        />
                    </div>

                    {/* Add tile button - only show in non-edit mode */}
                    {!tabUIState?.edit && (
                    <div className="w-full border-b py-1">
                        <AddTile
                            project={project || ""}
                            interfaceId={interfaceId}
                            tabId={tabId || ""}
                            anyTileLoading={anyTileLoading}
                            tabActions={tabActions}
                            tileActions={tileActions}
                        />
                    </div>
                    )}

                    {/* Show hidden items dropdown */}
                    <div className="w-full border-b py-1">
                        <BaseDropdown
                            button={
                                <ActionButton
                                    variant="ghost"
                                    icon={<Eye />}
                                    text="Show Hidden"
                                    tooltip="Show Hidden"
                                    size="sm"
                                    disabled={hiddenItems.length === 0 || isDisabled}
                                />
                            }
                        >
                            {hiddenItems.map((item, idx) => (
                                <DropdownMenuItem
                                    key={idx}
                                    onSelect={() => {
                                        if (syncedTabDataActions && item.id) {
                                            syncedTabDataActions?.updateTile(item.id, {
                                                position: {
                                                    x: (tileIds.length * 2) % 12,
                                                    y: (tileIds.length * 2) / 12,
                                                    width: 4,
                                                    height: 4,
                                                },
                                                minW: null,
                                                minH: null,
                                                visible: true
                                            });
                                        }
                                    }}
                                    disabled={hiddenItems.length === 0}
                                    className="w-64"
                                >
                                    {item.name}
                                </DropdownMenuItem>
                            ))}
                        </BaseDropdown>
                    </div>

                    {/* Paste button - only show in non-edit mode */}
                    {!tabUIState?.edit && (
                    <div className="w-full border-b py-1">
                        <ActionButton
                            variant="ghost"
                            icon={<Clipboard />}
                            text="Paste"
                            tooltip="Paste"
                            disabled={!tabUIState?.copied || isDisabled}
                            onClick={handlePaste}
                        />
                    </div>
                    )}

                    {/* Color selector - only show in non-edit mode */}
                    {!tabUIState?.edit && (
                    <div className="w-full pt-1">
                        <ColorPicker
                            value={resolveColorHierarchy(null, tabUIState?.color)}
                            onChange={(color) => syncedTabUIActions?.setColor(color)}
                            useDialog={true}
                            showReset={true}
                            onReset={() => syncedTabUIActions?.setColor(undefined)}
                        >
                            <ActionButton
                                className="cursor-pointer hover:z-10"
                                icon={<Palette />}
                                variant="ghost"
                                text="Change Tab Color"
                                tooltip="Change Tab Color"
                                disabled={!project}
                            />
                        </ColorPicker>
                    </div>
                    )}
                </div>
            </BaseDropdown>


            {/* Right side - Edit and Interactive mode switches */}
            <div className="flex items-center gap-2 backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg px-3 py-1 h-8">
                <Switch
                    id="edit"
                    checked={tabUIState?.edit || false}
                    onCheckedChange={() => {
                        const newEditState = !tabUIState?.edit;
                        tabUIActions?.setEdit(newEditState);
                        
                        // Show helpful notification
                        showSuccessToast(
                            "Edit Mode",
                            newEditState 
                                ? "You can now edit your interface! Drag tiles, resize, and modify layouts." 
                                : "Edit mode disabled. Your interface layout is now locked."
                        );
                    }}
                    disabled={!project}
                />
                <Label htmlFor="edit" className="cursor-pointer">
                    <Tooltip content="Edit">
                        <Hammer name="edit" size={18} color={tabUIState?.edit ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>

            <div className="flex items-center gap-2 backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg px-3 py-1 h-8">
                <Switch
                    id="interactive"
                    checked={tabUIState?.interactive || false}
                    onCheckedChange={() => {
                        const newInteractiveState = !tabUIState?.interactive;
                        tabUIActions?.setInteractive(newInteractiveState);
                        
                        // Show helpful notification
                        showSuccessToast(
                            "Interactive Mode",
                            newInteractiveState 
                                ? "Interactive mode enabled! You can now sort, filter, and manipulate data controls." 
                                : "Interactive mode disabled. Sorting, filtering, and data controls are now locked."
                        );
                    }}
                    disabled={!project}
                />
                <Label htmlFor="interactive" className="cursor-pointer">
                    <Tooltip content="Interactive">
                        <SquareMousePointer name="interactive" size={18} color={tabUIState?.interactive ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>


        </div>
    );
};

export default InterfaceButtons;
