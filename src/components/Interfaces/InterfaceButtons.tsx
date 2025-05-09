"use client";

import { TabProps, ContextActions, TileProps, LogsActions, GranularTabActions, GranularTileActions } from "@/types/evals/grid";
import { Eye, Hammer, SquareMousePointer, Info, Ellipsis } from "lucide-react";
import { Check, Clipboard, ListRestart, Loader2, TriangleAlert, Save, FocusIcon, Palette } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { useRouter } from "next/navigation";
import { ResponseProps } from "@/types/common";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import Tooltip from "../Common/Misc/Tooltip";
import ColorPicker from "../Common/Misc/ColorPicker";
import { FileUpload } from "./FileUpload";
import AddTile from "./AddTile";
import ContextSelector from "./Table/Content/ContextSelector";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { SetStateAction, useMemo } from "react";

import { useTab } from "@/contexts/hooks/tab";
import { useProject } from "@/contexts/hooks/project";
import { useTiles } from "@/contexts/hooks/useStore";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { useUpdateTabQuery } from '@/hooks/Query/useTabsQuery';
import { useRestoreLastSavedTabWithTilesQuery } from '@/hooks/Query/useRestoreLastSavedTabWithTilesQuery';

// Create a response object that matches ResponseProps interface
const createResponse = (success: boolean, message: string): ResponseProps => {
    return { 
        success: success ? "true" : "false", 
        message
    };
};

const InterfaceButtons = ({
    interfaceId,
    tabQueryParam,
    setSaveDialog,
    logsActions,
    contextActions,
    tabActions,
    tileActions,
    disabled,
}: {
    interfaceId: string,
    tabQueryParam: string | null,
    setSaveDialog: (value: SetStateAction<boolean>) => void,
    logsActions: LogsActions,
    contextActions: ContextActions,
    tabActions: GranularTabActions,
    tileActions: GranularTileActions,
    disabled?: boolean,
}) => {
    const router = useRouter();
    
    // Use hooks for tab operations
    const updateTabMutation = useUpdateTabQuery();
    const restoreTabMutation = useRestoreLastSavedTabWithTilesQuery();
    
    // Get the project data and the contexts with granular access
    const project = useStoreContext((state) => state.activeProjectId);
    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));
    const { data: projectDataState } = useProject(project);
    const contexts = projectDataState?.contexts || [];

    // Tab states and actions with granular access
    const {
        data: tabDataState,
        ui: tabUIState,
        dataActions: tabDataActions,
        uiActions: tabUIActions,
    } = useTab(tabQueryParam || "", interfaceId);

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
        if (tabDataActions && tabUIActions && project && tabQueryParam) {
            // First update the tab's context
            tabDataActions.setGlobalContext(ctx);
            
            // Update the context in the backend using the update tab mutation
            updateTabMutation.mutate({
                interface_id: project,
                name: tabQueryParam,
                data: {
                    global_context: ctx
                },
                actions: tabActions
            });

            // Then update each tile's context-related properties if needed
            tiles.forEach(tile => {
                // Get the corresponding item to check current context
                const item = items.find(i => i.i === tile.name);
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
                    tabDataActions.updateTile(tile.name || "", {
                        context: newContext
                    });

                    // Update the tile's column_context
                    if (tile.type === "Table" && tile.tableTile) {
                        tabDataActions.updateTableTile(tile.name || "", {
                            column_context: validItemContext ? item.column_context : undefined
                        });
                    }
                }
            });

            // Set data pending and refresh
            tabUIActions.setDataPending(true);
            router.refresh();
        }
    };

    // Handler for pasting tile
    const handlePaste = () => {
        if (tabUIState?.copied && tabDataActions) {
            const newCounter = tileIds.length + 1;
            const newName = "Tile_" + newCounter;
            tabDataActions.addTile(tabUIState.copied, newName);
            tabUIActions?.setCopied(undefined);
        }
    };

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
            >
                <div className="w-fit flex flex-col items-center p-2">

                    {/* File upload */}
                    <div className="border-b pb-1">
                        <FileUpload
                            contexts={contexts}
                            logsActions={logsActions}
                            project={project}
                        />
                    </div>

                    {/* Focus pane */}
                    <div className="border-b py-1">
                        <ActionButton
                            className="transition-all"
                            tooltip="Open focus pane"
                            icon={<FocusIcon />}
                            variant="ghost"
                            disabled={isDisabled}
                            onClick={() => tabUIActions?.setFocusDialog(true)}
                        />
                    </div>

                    {/* Context selector */}
                    <div className="border-b py-1">
                        <ContextSelector
                            tabId={tabQueryParam || undefined}
                            interfaceId={interfaceId}
                            projectId={project || undefined}
                            context={tabDataState?.globalContext}
                            contexts={contexts}
                            setContext={handleContextChange}
                            logsActions={logsActions}
                            contextActions={contextActions}
                            setPending={tabUIActions?.setPending!}
                        />
                    </div>

                    {/* Save button */}
                    <div className="border-b py-1">
                        <ActionButton
                            className="transition-all"
                            tooltip={!project ? "Select a project first" : "Save Interface"}
                            icon={saveIcon}
                            variant={variant}
                            disabled={isDisabled}
                            onClick={async () => setSaveDialog(true)}
                        />
                    </div>

                    {/* Reset button */}
                    <div className="border-b py-1">
                        <ActionButton
                            className="transition-all"
                            tooltip={!project ? "Select a project first" : "Return to last saved tab"}
                            icon={resetIcon}
                            variant="ghost"
                            disabled={isDisabled || tabUIState?.resetting}
                            onClick={async () => {
                                if (!tabQueryParam || !project || !tabUIActions) return;
                                
                                // Set resetting state
                                tabUIActions.setResetting(true);
                                
                                try {
                                    // Restore the tab from its checkpoint using the new hook
                                    const result = await restoreTabMutation.mutateAsync({
                                        interface_id: interfaceId,
                                        tab_name: tabQueryParam,
                                        tab_actions: tabActions,
                                        tile_actions: tileActions
                                    });
                                    
                                    // Log the result
                                    console.log("Tab restore result:", result);
                                    
                                    // Update UI to show reset is complete
                                    tabUIActions.setEdit(true);
                                    router.refresh();
                                } catch (error: any) {
                                    console.error("Error restoring tab:", error);
                                } finally {
                                    // Reset the resetting state after a delay
                                    setTimeout(() => {
                                        tabUIActions.setResetting(false);
                                    }, 1500);
                                }
                            }}
                        />
                    </div>

                    {/* Add tile button */}
                    <div className="border-b py-1">
                        <AddTile
                            project={project || ""}
                            interfaceId={interfaceId}
                            tabId={tabQueryParam || ""}
                            anyTileLoading={anyTileLoading}
                        />
                    </div>

                    {/* Show hidden items dropdown */}
                    <div className="border-b py-1">
                        <BaseDropdown
                            button={
                                <ActionButton
                                    variant="ghost"
                                    icon={<Eye />}
                                    tooltip="Show hidden"
                                    size="sm"
                                    disabled={hiddenItems.length === 0 || isDisabled}
                                />
                            }
                        >
                            {hiddenItems.map((item, idx) => (
                                <DropdownMenuItem
                                    key={idx}
                                    onSelect={() => {
                                        if (tabDataActions && item.i) {
                                            tabDataActions.updateTile(item.i, {
                                                position: {
                                                    x: (tileIds.length * 2) % 12,
                                                    y: (tileIds.length * 2) / 12,
                                                    width: 4,
                                                    height: 4,
                                                },
                                                minW: undefined,
                                                minH: undefined,
                                                visible: true
                                            });
                                        }
                                    }}
                                    disabled={hiddenItems.length === 0}
                                    className="w-64"
                                >
                                    {item.i}
                                </DropdownMenuItem>
                            ))}
                        </BaseDropdown>
                    </div>

                    {/* Paste button */}
                    <div className="border-b py-1">
                        <ActionButton
                            variant="ghost"
                            icon={<Clipboard />}
                            tooltip="Paste"
                            disabled={!tabUIState?.copied || isDisabled}
                            onClick={handlePaste}
                        />
                    </div>

                    {/* Color selector */}
                    <div className="pt-1">
                        <ColorPicker
                            value={tabUIState?.color ?? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()}
                            onChange={(color) => tabUIActions?.setColor(color)}
                        >
                            <ActionButton
                                className="cursor-pointer hover:z-10"
                                icon={<Palette />}
                                variant="ghost"
                                tooltip="Change tab primary color"
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
