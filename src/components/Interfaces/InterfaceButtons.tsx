"use client";

import { TabProps, ContextActions, TileProps } from "@/types/evals/grid";
import { Eye, Hammer, SquareMousePointer, Info } from "lucide-react";
import { Check, Clipboard, ListRestart, Loader2, TriangleAlert, Save, FocusIcon } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { useRouter } from "next/navigation";
import { ResponseProps } from "@/types/common";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import Tooltip from "../Common/Misc/Tooltip";
import AddTile from "./AddTile";
import ContextSelector from "./Table/Content/ContextSelector";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTab } from "@/contexts/hooks/useTab";
import { SetStateAction, useMemo } from "react";
import { useProject } from "@/contexts/hooks/useProject";
import { useStore } from "@/contexts/hooks/useStore";

const InterfaceButtons = ({
    interfaceId,
    tabQueryParam,
    newCounter,
    setNewCounter,
    updateTab,
    focusDialog,
    setFocusDialog,
    saveDialog,
    setSaveDialog,
    contextActions,
}: {
    interfaceId: string,
    tabQueryParam: string | null,
    newCounter: number,
    setNewCounter: (newCounter: number) => void,
    updateTab: (savedTab?: TabProps | null, updatedTileProps?: TileProps[] | TileProps | null) => Promise<ResponseProps>,
    focusDialog: boolean,
    setFocusDialog: (value: SetStateAction<boolean>) => void,
    saveDialog: boolean,
    setSaveDialog: (value: SetStateAction<boolean>) => void,
    contextActions: ContextActions,
}) => {
    const router = useRouter();

    // Get the project data and the contexts with granular access
    const project = useStoreContext((state) => state.activeProjectId);
    const { data: projectDataState } = useProject(project);
    
    const contexts = projectDataState?.contexts || [];

    // Tab states and actions with granular access
    const { 
        data: tabDataState,
        ui: tabUIState,
        dataActions: tabDataActions,
        uiActions: tabUIActions,
        actions: tabActions 
    } = useTab(tabQueryParam || "", interfaceId);

    // Get tileIds from tab data properly
    const tileIds = useMemo(() => tabDataState?.tileIds || [], [tabDataState?.tileIds]);

    // Only subscribe to a subset of the tiles objects to incl. name, type and tableTile only
    const tiles = useStore().getTiles(tileIds, ["name", "type", "tableTile"]);

    // Calculate derived state
    const items = useMemo(() => {
        return !tabUIActions ? [] : tabUIActions.getItems();
    }, [tabUIActions]);

    // Get hidden items
    const hiddenItems = items.filter(item => !item.visible);

    const saveIcon = tabUIState?.saveSuccess ? <Check /> : tabUIState?.saveSuccess === false ? <TriangleAlert /> : <Save />;
    const resetIcon = tabUIState?.resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;
    const variant = tabUIState?.saveSuccess === false ? "destructive" : "outline";

    // Handle context change 
    const handleContextChange = (ctx: string) => {
        if (tabActions) {
            // First update the tab's context
            tabDataActions.setGlobalContext(ctx);

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
            const newName = "Tile_" + newCounter;
            tabDataActions.addTile(tabUIState.copied, newName);

            setNewCounter(newCounter + 1);
            tabUIActions?.setCopied(undefined);
        }
    };

    return (
        <div className="flex items-center gap-2 px-2">
            {/* Left side - Focus and Context selector */}
            <ActionButton
                className="transition-all"
                tooltip="Open Focus Pane"
                icon={<FocusIcon/>}
                variant={"outline"}
                disabled={!project || !tabQueryParam || tabUIState?.pending}
                onClick={() => setFocusDialog(true)}
            />
            
            <ContextSelector
                projectId={project || undefined}
                context={tabDataState?.globalContext}
                contexts={contexts}
                setContext={handleContextChange}
                contextActions={contextActions}
                refresh={() => updateTab()}
                setPending={tabUIActions?.setPending!}
            />
            
            {/* Middle - Save, Reset, AddTile */}
            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Save Interface"}
                icon={saveIcon}
                variant={variant}
                disabled={!project || !tabQueryParam || tabUIState?.pending}
                onClick={async () => setSaveDialog(true)}
            />

            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Return to last saved interface"}
                icon={resetIcon}
                variant="outline"
                disabled={!project || tabUIState?.pending}
                onClick={() => {
                    updateTab(tabDataState?.savedTab);
                    tabUIActions?.setResetting(true);
                    tabUIActions?.setEdit(true);
                    router.refresh();
                }}
            />

            <AddTile
                project={project || ""}
                tabId={tabQueryParam || ""}
                newCounter={newCounter}
                setNewCounter={setNewCounter}
            />

            {/* Show hidden items dropdown */}
            <BaseDropdown
                button={
                    <ActionButton
                        variant="outline"
                        icon={<Eye/>}
                        tooltip="Show Hidden"
                        size="sm"
                        disabled={hiddenItems.length === 0 || tabUIState?.pending}
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

            {/* Paste button */}
            <ActionButton
                variant="outline"
                icon={<Clipboard/>}
                tooltip="Paste"
                disabled={!tabUIState?.copied || tabUIState?.pending}
                onClick={handlePaste}
            />

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
