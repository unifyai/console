"use client";

import { X } from "lucide-react";
import { Plus } from "lucide-react";
import { TabsList, TabsTrigger } from "../UI/tabs";
import { Input } from "../UI/input";
import { useEffect, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { GranularTabActions, GranularInterfaceActions, GranularTileActions, FieldsActions, LogsActions, ProjectsActions, ContextActions } from "@/types/evals/grid";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTab } from "@/contexts/hooks/tab";
import { useInterfaceSync } from "@/contexts/hooks/interface/sync/useInterfaceSync";
import { toast } from "sonner";
import { useTabStreamingQuery } from '@/hooks/Query/useTabStreamingQuery';

const InterfaceTabs = ({ 
  tabIdOrName,
  interfaceId,  
  projectsActions,
  contextActions,
  interfaceActions,
  tabActions, 
  tileActions,
  fieldsActions,
  logsActions,
  setTabQueryParam,
  pendingTabChange,
}: {
    tabIdOrName: string | null,
    interfaceId: string,
    projectsActions: ProjectsActions,
    contextActions: ContextActions,
    interfaceActions: GranularInterfaceActions,
    tabActions: GranularTabActions,
    tileActions: GranularTileActions,
    fieldsActions: FieldsActions,
    logsActions: LogsActions,
    setTabQueryParam: (tabQueryParam: string | null) => void,
    pendingTabChange?: string,
}) => {
    // Tab states and actions with granular access
    const { meta: tabMetaState, ui: tabUIState, uiActions: tabUIActions } = useTab(tabIdOrName || "");
    const tabName = tabMetaState?.name || "";

    const [tabQueryParamState, setTabQueryParamState] = useState(tabName || "");
    const [hoveredTab, setHoveredTab] = useState<string | undefined>();
    const [errorMsg, setErrorMsg] = useState<string>();

    // Global states
    const project = useStoreContext((s) => s.activeProjectId);

    // SYNCHRONISED INTERFACE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedInterfaceActions } = useInterfaceSync(interfaceId, project, interfaceActions, tabActions);
    const syncedInterfaceDataActions = syncedInterfaceActions?.data;
    const syncedInterfaceUIActions = syncedInterfaceActions?.ui;

    const tabNamesToShow = syncedInterfaceDataActions?.getTabNames() || [];

    // Streaming integration for instant tab switching (when enabled)
    const { prefetchedTabs } = useTabStreamingQuery(
        interfaceId,
        tabName, 
        project,
        {
            tabActions,
            tileActions,
            fieldsActions,
            logsActions,
            projectsActions,
            contextActions,
        }
    );

    useEffect(() => {
        setTabQueryParamState(tabName || "");
    }, [tabName]);

    // Enhanced tab click handler with instant switching
    const handleTabClick = (tabName: string) => {
        // Only update the URL param, Interface.tsx's handleTabChange will handle the actual switching
        setTabQueryParam(tabName);
    };

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
        const duplicate = tabNamesToShow.some(name => 
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

            setTabQueryParamState(newName);
            
            toast.success(`Tab renamed to "${newName}"`);
        } catch (error) {
            console.error("Error renaming tab:", error);
            toast.error("Failed to rename tab. Please try again.");
        }
    };

    // Handle tab deletion
    const handleDeleteTab = async (tabNameToDelete: string) => {
        try {
            // If deleting active tab, switch to another tab first
            if (tabName === tabNameToDelete) {
                tabUIActions?.setPending(true);
                const tabIdx = tabNamesToShow.indexOf(tabNameToDelete);
                const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : tabNamesToShow.length > 1 ? 1 : -1;
                const nextTabName = nextTabIdx !== -1 ? tabNamesToShow[nextTabIdx] : null;
                
                // Use synchronized action to remove the tab
                syncedInterfaceDataActions?.removeTab(tabNameToDelete);
                
                // Update active tab using synced action
                if (nextTabName && syncedInterfaceUIActions) {
                    syncedInterfaceUIActions.setActiveTab(nextTabName);
                }
            } else {
                // Use synchronized action to remove the tab
                syncedInterfaceDataActions?.removeTab(tabNameToDelete);
            }
            
            toast.success(`Tab "${tabNameToDelete}" removed`);
        } catch (error) {
            console.error("Error deleting tab:", error);
            toast.error("Failed to delete tab. Please try again.");
        }
    };

    // Handle tab creation
    const handleCreateTab = async () => {
        try {
            // Generate a new tab name that doesn't exist
            let initialIndex = tabNamesToShow.length + 1;
            while (tabNamesToShow.includes(`tab${initialIndex}`)) {
                initialIndex++;
            }
            const newTabName = `tab${initialIndex}`;
            
            // Set pending state before operation
            tabUIActions?.setPending(true);
            
            // Use synchronized action to add a new tab AND WAIT for it to complete
            const result = await syncedInterfaceDataActions?.addTab(newTabName);
            console.log("Tab creation result:", result);
            
            // Only update active tab AFTER the tab has been created successfully
            if (result && syncedInterfaceUIActions) {
                // Update active tab using synced action
                syncedInterfaceUIActions.setActiveTab(newTabName);
                setTabQueryParamState(newTabName);
                tabUIActions?.setPending(false);
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
            {tabNamesToShow.length > 0 && <TabsList className="rounded-md justify-between">
                <div className="flex flex-row gap-3">
                    {tabNamesToShow.map((tabNameToShow, idx) => {
                        return (
                            <TabsTrigger
                                key={idx}
                                value={tabNameToShow}
                                className="relative flex flex-row gap-2 data-[state=active]:text-accent"
                                onMouseEnter={() => setHoveredTab(tabNameToShow)}
                                onMouseLeave={() => setHoveredTab(undefined)}
                            >
                                {tabName == tabNameToShow ? (
                                    <Input
                                        value={tabQueryParamState}
                                        disabled={tabUIState?.pending || tabUIState?.dataPending}
                                        onInput={(event: React.ChangeEvent<HTMLInputElement>) => {
                                            setTabQueryParamState(event.target.value);
                                            // Clear error on input
                                            if (errorMsg) setErrorMsg(undefined);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && tabNameToShow != tabQueryParamState && !tabNamesToShow.includes(tabQueryParamState)) {
                                                handleRenameTab(tabNameToShow, tabQueryParamState);
                                            }
                                            else if (e.key == "Enter" && tabNameToShow == tabQueryParamState) {
                                                setTabQueryParamState(tabNameToShow);
                                                setErrorMsg(undefined);
                                            }
                                        }}
                                        className="px-0 h-5 w-16 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                                    />
                                ) : (
                                    <div className="h-5 w-16 text-center relative" onClick={() => handleTabClick(tabNameToShow)}>
                                        {tabNameToShow}
                                        {/* Cached data indicator for streaming - show if streaming enabled or if tab is prefetched */}
                                        {(() => {
                                          const isPrefetched = prefetchedTabs?.has(tabNameToShow) || false;
                                          return (
                                            <div className={`absolute -top-1 -left-1 w-1.5 h-1.5 bg-green-500 ${isPrefetched ? "" : "animate-pulse"} rounded-full`} title="Tab Prefetched" />
                                          );
                                        })()}
                                        {/* Pending tab change indicator */}
                                        {pendingTabChange === tabNameToShow && (
                                            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-0.5 bg-primary animate-pulse rounded-full" 
                                                 title="Tab switch pending" />
                                        )}
                                    </div>
                                )}
                                <div
                                    className={`z-10 absolute -top-1 -right-1 cursor-pointer mb-auto hover:text-white hover:bg-primary rounded-sm ${hoveredTab == tabNameToShow ? "opacity-100" : "opacity-0"}`}
                                    onMouseEnter={() => tabName != tabNameToShow && tabUIActions?.setDeleting(true)}
                                    onMouseLeave={() => tabName != tabNameToShow && tabUIActions?.setDeleting(false)}
                                    onClick={() => {
                                        if (tabName == tabNameToShow) {
                                            // tabUIActions?.setPending(true);
                                            const tabIdx = tabNamesToShow.indexOf(tabNameToShow);
                                            const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : tabNamesToShow.length > 1 ? 1 : -1;
                                            const nextTabName = nextTabIdx != -1 ? tabNamesToShow[nextTabIdx] : null;
                                            if (nextTabName && syncedInterfaceUIActions) {
                                                syncedInterfaceUIActions.setActiveTab(nextTabName);
                                            }
                                        }
                                        handleDeleteTab(tabNameToShow);
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
