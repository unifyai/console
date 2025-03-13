"use client";

import { TabProps } from "@/types/evals/grid";
import { Eye, Hammer, SquareMousePointer } from "lucide-react";
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
}: {
    interfaceId: string,
    tabQueryParam: string | null,
    newCounter: number,
    setNewCounter: (newCounter: number) => void,
    updateTab: (savedTab?: TabProps | null) => Promise<ResponseProps>,
    focusDialog: boolean,
    setFocusDialog: (value: SetStateAction<boolean>) => void,
    saveDialog: boolean,
    setSaveDialog: (value: SetStateAction<boolean>) => void,
}) => {
    const router = useRouter();

    // Global states from the store
    const project = useStoreContext(s => s.activeProjectId);
    
    // Tab states and actions - get all UI states from here
    const { tab: tabData, actions: tabActions } = useTab(tabQueryParam || "", interfaceId);

    // Get contexts from the interface data
    const contexts = useStoreContext((state) => {
        const projectData = state.projectsById[project || ""];
        return projectData?.contexts || [];
    });

    // Calculate derived state
    const items = useMemo(() => {
        return !tabActions || !tabData ? [] : tabActions.getItems();
    }, [tabActions, tabData]);

    // Get hidden items
    const hiddenItems = items.filter(item => !item.visible);

    const saveIcon = tabData?.saveSuccess ? <Check /> : tabData?.saveSuccess === false ? <TriangleAlert /> : <Save />;
    const resetIcon = tabData?.resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;
    const variant = tabData?.saveSuccess === false ? "destructive" : "outline";

    // Handle context change 
    const handleContextChange = (ctx: string) => {
        if (tabActions && tabData) {
            // First update the tab's context
            tabActions.setGlobalContext(ctx);

            // Then update each tile's context-related properties if needed
            if (tabData.tiles) {
                Object.values(tabData.tiles).forEach(tile => {
                    // Get the corresponding item to check current context
                    const item = items.find(i => i.i === tile.id);
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
                        tabActions.updateTile(tile.id, {
                            context: newContext
                        });

                        // Update the tile's column_context
                        if (tile.type === "Table" && tile.tableData) {
                            tabActions.updateTableTile(tile.id, {
                                column_context: validItemContext ? item.column_context : undefined
                            });
                        }
                    }
                });
            }

            // Set data pending and refresh
            tabActions.setDataPending(true);
            router.refresh();
        }
    };

    // Handler for pasting tile
    const handlePaste = () => {
        if (tabData?.copied && tabActions) {
            const copiedTile = items.find(item => item.i === tabData.copied);
            if (copiedTile && tabData) {
                const tileToClone = tabData.tiles[tabData.copied];
                if (tileToClone) {
                    const newId = "Tile_" + newCounter;
                    tabActions.initTile(newId, {
                        type: tileToClone.type,
                        name: `Copy of ${tileToClone.name}`,
                        position: {
                            x: (Object.keys(tabData.tiles).length * 2) % 12,
                            y: Math.floor((Object.keys(tabData.tiles).length * 2) / 12),
                            width: tileToClone.position.width,
                            height: tileToClone.position.height
                        },
                        minW: undefined,
                        minH: undefined,
                        visible: true
                    });
                    setNewCounter(newCounter + 1);
                    tabActions.setCopied(undefined);
                }
            }
        }
    };

    return (
        <div className="flex items-center gap-2 pl-4 pr-10">
            {/* Left side - Focus and Context selector */}
            <ActionButton
                className="transition-all"
                tooltip="Open Focus Pane"
                icon={<FocusIcon/>}
                variant={"outline"}
                disabled={!project || !tabQueryParam || tabData?.pending}
                onClick={() => setFocusDialog(true)}
            />
            
            <ContextSelector
                context={tabData?.globalContext}
                contexts={contexts}
                setContext={handleContextChange}
            />
            
            {/* Middle - Save, Reset, AddTile */}
            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Save Interface"}
                icon={saveIcon}
                variant={variant}
                disabled={!project || !tabQueryParam || tabData?.pending}
                onClick={async () => setSaveDialog(true)}
            />

            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Return to last saved interface"}
                icon={resetIcon}
                variant="outline"
                disabled={!project || tabData?.pending}
                onClick={async () => {
                    await updateTab(tabData?.savedTab);
                    tabActions?.setResetting(true);
                    tabActions?.setEdit(true);
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
                        disabled={hiddenItems.length === 0 || tabData?.pending}
                    />
                }
            >
                {hiddenItems.map((item, idx) => (
                    <DropdownMenuItem
                        key={idx}
                        onSelect={() => {
                            if (tabActions && item.i) {
                                tabActions.updateTile(item.i, {
                                    position: {
                                        x: (Object.keys(tabData?.tiles || {}).length * 2) % 12,
                                        y: (Object.keys(tabData?.tiles || {}).length * 2) / 12,
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
                disabled={!tabData?.copied || tabData?.pending}
                onClick={handlePaste}
            />

            {/* Right side - Edit and Interactive mode switches */}
            <div className="flex items-center gap-2 border rounded-md p-1">
                <Switch
                    id="edit-mode"
                    checked={tabData?.edit || false}
                    onCheckedChange={() => tabActions?.setEdit(!tabData?.edit)}
                    disabled={!project}
                />
                <Label htmlFor="edit-mode" className="cursor-pointer">
                    <Tooltip content="Edit mode">
                        <Hammer name="edit" size={18} color={tabData?.edit ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>

            <div className="flex items-center gap-2 border rounded-md p-1">
                <Switch
                    id="interactive-mode"
                    checked={tabData?.interactive || false}
                    onCheckedChange={() => tabActions?.setInteractive(!tabData?.interactive)}
                    disabled={!project}
                />
                <Label htmlFor="interactive-mode" className="cursor-pointer">
                    <Tooltip content="Interactive mode">
                        <SquareMousePointer name="interactive" size={18} color={tabData?.interactive ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>
        </div>
    );
};

export default InterfaceButtons;
