"use client";

import { X } from "lucide-react";
import { Plus } from "lucide-react";
import { TabsList, TabsTrigger } from "../UI/tabs";
import { Input } from "../UI/input";
import { useEffect, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { GranularTabActions, GranularInterfaceActions } from "@/types/evals/grid";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTab } from "@/contexts/hooks/tab";
import { useQueryState } from "nuqs";
import { useInterfaceSync } from "@/contexts/hooks/interface/sync/useInterfaceSync";
import { toast } from "sonner";

const InterfaceTabs = ({ 
  tabIdOrName,
  interfaceId,  
  interfaceActions,
  tabActions, 
  setTabQueryParam 
}: {
    tabIdOrName: string | null,
    interfaceId: string,
    interfaceActions: GranularInterfaceActions,
    tabActions: GranularTabActions,
    setTabQueryParam: (tabQueryParam: string | null) => void,
}) => {
    const [_, setTabQueryParamNoReload] = useQueryState("tab");
    const [tabQueryParamState, setTabQueryParamState] = useState(tabIdOrName || "");
    const [hoveredTab, setHoveredTab] = useState<string | undefined>();
    const [errorMsg, setErrorMsg] = useState<string>();

    // Global states
    const project = useStoreContext((s) => s.activeProjectId);

    // SYNCHRONISED INTERFACE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedInterfaceActions } = useInterfaceSync(interfaceId, project, interfaceActions, tabActions);
    const syncedInterfaceDataActions = syncedInterfaceActions?.data;

    const tabNames = syncedInterfaceDataActions?.getTabNames() || [];

    // Tab states and actions with granular access
    const { meta: tabMetaState, ui: tabUIState, uiActions: tabUIActions } = useTab(tabIdOrName || "");

    useEffect(() => {
        setTabQueryParamState(tabIdOrName || "");
    }, [tabIdOrName]);

    // Handle tab rename
    const handleRenameTab = async (oldName: string, newName: string) => {
        // Clear any previous error message
        setErrorMsg(undefined);
        
        // Validation
        if (oldName === newName) {
            return;
        }
        
        if (!newName.trim()) {
            setErrorMsg("Tab name cannot be empty");
            return;
        }
        
        // Check for duplicates (case insensitive)
        const duplicate = tabNames.some(name => 
            name.toLowerCase() === newName.trim().toLowerCase() && 
            name !== oldName
        );
        
        if (duplicate) {
            setErrorMsg(`A tab called "${newName.trim()}" already exists`);
            return;
        }

        try {
            // Use synchronized action to rename the tab
            syncedInterfaceDataActions?.renameTab(oldName, newName);

            setTabQueryParamNoReload(tabQueryParamState);
            
            toast.success(`Tab renamed to "${newName}"`);
        } catch (error) {
            console.error("Error renaming tab:", error);
            toast.error("Failed to rename tab. Please try again.");
        }
    };

    // Handle tab deletion
    const handleDeleteTab = async (tabName: string) => {
        try {
            // If deleting active tab, switch to another tab first
            if (tabIdOrName === tabName) {
                tabUIActions?.setPending(true);
                const tabIdx = tabNames.indexOf(tabName);
                const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : tabNames.length > 1 ? 1 : -1;
                const nextTabName = nextTabIdx !== -1 ? tabNames[nextTabIdx] : null;
                
                // Use synchronized action to remove the tab
                syncedInterfaceDataActions?.removeTab(tabName);
                
                // Update URL param to new tab
                setTabQueryParam(nextTabName);
            } else {
                // Use synchronized action to remove the tab
                syncedInterfaceDataActions?.removeTab(tabName);
            }
            
            toast.success(`Tab "${tabName}" removed`);
        } catch (error) {
            console.error("Error deleting tab:", error);
            toast.error("Failed to delete tab. Please try again.");
        }
    };

    // Handle tab creation
    const handleCreateTab = async () => {
        try {
            // Generate a new tab name that doesn't exist
            let initialIndex = tabNames.length + 1;
            while (tabNames.includes(`tab${initialIndex}`)) {
                initialIndex++;
            }
            const newTabName = `tab${initialIndex}`;
            
            // Set pending state before operation
            tabUIActions?.setPending(true);
            
            // Use synchronized action to add a new tab AND WAIT for it to complete
            const result = await syncedInterfaceDataActions?.addTab(newTabName);
            console.log("Tab creation result:", result);
            
            // Only update URL params AFTER the tab has been created successfully
            if (result) {
                // Update URL param to new tab
                setTabQueryParam(newTabName);
                setTabQueryParamState(newTabName);
                
                toast.success(`New tab "${newTabName}" created`);
            } else {
                tabUIActions?.setPending(false);
                toast.error("Failed to create tab. Please try again.");
            }
        } catch (error) {
            // Reset pending state on error
            tabUIActions?.setPending(false);
            console.error("Error creating tab:", error);
            toast.error("Failed to create tab. Please try again.");
        }
    };

    return (
        <div className="flex gap-4 px-4">
            {tabNames.length > 0 && <TabsList className="rounded-md justify-between">
                <div className="flex flex-row gap-3">
                    {tabNames.map((tabName, idx) => {
                        return (
                            <TabsTrigger
                                key={idx}
                                value={tabName}
                                className="relative flex flex-row gap-2 data-[state=active]:text-accent"
                                onMouseEnter={() => setHoveredTab(tabName)}
                                onMouseLeave={() => setHoveredTab(undefined)}
                            >
                                {tabIdOrName == tabName ? (
                                    <Input
                                        value={tabQueryParamState}
                                        disabled={tabUIState?.pending || tabUIState?.dataPending}
                                        onInput={(event: React.ChangeEvent<HTMLInputElement>) => {
                                            setTabQueryParamState(event.target.value);
                                            // Clear error on input
                                            if (errorMsg) setErrorMsg(undefined);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && tabName != tabQueryParamState && !tabNames.includes(tabQueryParamState)) {
                                                handleRenameTab(tabName, tabQueryParamState);
                                            }
                                            else if (e.key == "Enter" && tabName == tabQueryParamState) {
                                                setTabQueryParamState(tabName);
                                                setErrorMsg(undefined);
                                            }
                                        }}
                                        className="px-0 h-5 w-16 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                                    />
                                ) : (
                                    <div className="h-5 w-16 text-center" onClick={() => setTabQueryParam(tabName)}>
                                        {tabName}
                                    </div>
                                )}
                                <div
                                    className={`z-10 absolute -top-1 -right-1 cursor-pointer mb-auto hover:text-white hover:bg-primary rounded-sm ${hoveredTab == tabName ? "opacity-100" : "opacity-0"}`}
                                    onMouseEnter={() => tabIdOrName != tabName && tabUIActions?.setDeleting(true)}
                                    onMouseLeave={() => tabIdOrName != tabName && tabUIActions?.setDeleting(false)}
                                    onClick={() => {
                                        if (tabIdOrName == tabName) {
                                            tabUIActions?.setPending(true);
                                            const tabIdx = tabNames.indexOf(tabName);
                                            const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : tabNames.length > 1 ? 1 : -1;
                                            const nextTabName = nextTabIdx != -1 ? tabNames[nextTabIdx] : null;
                                            setTabQueryParam(nextTabName);
                                        }
                                        handleDeleteTab(tabName);
                                    }}
                                >
                                    <X size={14} />
                                </div>
                            </TabsTrigger>
                        );
                    })}
                </div>
            </TabsList>}
            <div className="flex flex-col gap-2">
                <ActionButton
                    variant="outline"
                    icon={<Plus />}
                    tooltip={"Add new tab"}
                    disabled={tabUIState?.pending}
                    onClick={handleCreateTab}
                />
                
                {errorMsg && (
                    <div className="text-xs text-destructive">{errorMsg}</div>
                )}
            </div>
        </div>
    )
};

export default InterfaceTabs;
