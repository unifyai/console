"use client";

import { ContextActions, LogsActions, GranularTabActions, GranularTileActions, GranularInterfaceActions } from "@/types/evals/grid";
import { Eye, Hammer, SquareMousePointer, Info, Ellipsis } from "lucide-react";
import { Check, Clipboard, ListRestart, Loader2, TriangleAlert, Save, FocusIcon, Palette } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { useRouter } from "next/navigation";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import Tooltip from "../Common/Misc/Tooltip";
import ColorPicker from "../Common/Misc/ColorPicker";
import { FileUpload } from "./FileUpload";
import AddTile from "./AddTile";
import ContextSelector from "./Table/Content/ContextSelector";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { SetStateAction, useEffect, useMemo, useState } from "react";

import { useTab } from "@/contexts/hooks/tab";
import { useProject } from "@/contexts/hooks/project";
import { useTiles } from "@/contexts/hooks/useStore";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { useRestoreLastSavedTabWithTilesQuery } from '@/hooks/Query/useRestoreLastSavedTabWithTilesQuery';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";

const InterfaceButtons = ({
    tabIdOrName,
    interfaceId,
    logsActions,
    contextActions,
    tabActions,
    tileActions,
    interfaceActions,
    disabled,
}: {
    tabIdOrName: string | null,
    interfaceId: string,
    logsActions: LogsActions,
    contextActions: ContextActions,
    tabActions: GranularTabActions,
    tileActions: GranularTileActions,
    interfaceActions: GranularInterfaceActions,
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
    const { data: projectDataState } = useProject(project);
    const contexts = projectDataState?.contexts || [];

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
            syncedTabDataActions.setGlobalContext(ctx, (pending) => tabUIActions.setPending(pending));
            
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

            // Set data pending and refresh
            tabUIActions.setDataPending(true);
            router.refresh();
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

    useEffect(() => {
        if (fileUploadOpen || globalContextOpen)
            setDropdownOpen(true);
        else
            setDropdownOpen(false);
    }, [fileUploadOpen, globalContextOpen]);

    return (
        <div className="flex items-center gap-2 px-4">
            <BaseDropdown
                context="tab"
                button={<ActionButton
                    tooltip="Manage Tab"
                    icon={<Ellipsis />}
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

                    {/* Focus pane */}
                    <div className="w-full border-b py-1">
                        <ActionButton
                            className="transition-all"
                            text="Open Focus Pane"
                            tooltip="Open Focus Pane"
                            icon={<FocusIcon />}
                            variant="ghost"
                            disabled={isDisabled}
                            onClick={() => setFocusPaneOpen(true)}
                        />
                    </div>

                    {/* Context selector */}
                    <div className="w-full border-b py-1">
                        <ContextSelector
                            tabId={tabId || undefined}
                            interfaceId={interfaceId}
                            projectId={project || undefined}
                            context={tabDataState?.globalContext}
                            contexts={contexts}
                            setContext={handleContextChange}
                            customOpen={globalContextOpen}
                            setCustomOpen={setGlobalContextOpen}
                            logsActions={logsActions}
                            contextActions={contextActions}
                            setPending={tabUIActions?.setPending!}
                        />
                    </div>

                    {/* Save button */}
                    <div className="w-full border-b py-1">
                        <ActionButton
                            className="transition-all"
                            text="Save Interface"
                            tooltip={!project ? "Select a project first" : "Save Interface"}
                            icon={saveIcon}
                            variant={variant}
                            disabled={isDisabled}
                            onClick={async () => setSaveInterfaceOpen(true)}
                        />
                    </div>

                    {/* Reset button */}
                    <div className="w-full border-b py-1">
                        <ActionButton
                            className="transition-all"
                            text="Reset Interface"
                            tooltip={!project ? "Select a project first" : "Reset Interface"}
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

                    {/* Add tile button */}
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

                    {/* Paste button */}
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

                    {/* Color selector */}
                    <div className="w-full pt-1">
                        <ColorPicker
                            value={tabUIState?.color ?? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()}
                            onChange={(color) => syncedTabUIActions?.setColor(color)}
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
                </div>
            </BaseDropdown>


            {/* Right side - Edit and Interactive mode switches */}
            <div className="flex items-center gap-2 border rounded-md p-1">
                <Switch
                    id="edit"
                    checked={tabUIState?.edit || false}
                    onCheckedChange={() => tabUIActions?.setEdit(!tabUIState?.edit)}
                    disabled={!project}
                />
                <Label htmlFor="edit" className="cursor-pointer">
                    <Tooltip content="Edit">
                        <Hammer name="edit" size={18} color={tabUIState?.edit ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>

            <div className="flex items-center gap-2 border rounded-md p-1">
                <Switch
                    id="interactive"
                    checked={tabUIState?.interactive || false}
                    onCheckedChange={() => tabUIActions?.setInteractive(!tabUIState?.interactive)}
                    disabled={!project}
                />
                <Label htmlFor="interactive" className="cursor-pointer">
                    <Tooltip content="Interactive">
                        <SquareMousePointer name="interactive" size={18} color={tabUIState?.interactive ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>

            <Tooltip content="Toggle info icons">
                <Info
                    name="help"
                    size={16}
                    onClick={() => {
                        if (project && tabUIState?.interactive) tabUIActions?.setHelp(!tabUIState?.help)
                    }}
                    opacity={!project || !tabUIState?.interactive ? 0.5 : 1}
                    className={`mb-0.5 ml-0.5 ${project && tabUIState?.interactive && tabUIState?.help ? "text-primary" : ""} ${project && tabUIState?.interactive && !tabUIState?.help ? "hover:text-primary" : ""}`}
                />
            </Tooltip>
        </div>
    );
};

export default InterfaceButtons;
