"use client";

import { Plus } from "lucide-react";
import { TabsList, TabsTrigger } from "../UI/tabs";
import { useMemo } from "react";
import { GranularTabActions, GranularInterfaceActions, GranularTileActions, FieldsActions, LogsActions, ProjectsActions, ContextActions, TabData } from "@/types/evals/grid";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTab, useTabUI } from "@/contexts/hooks/tab";
import { useInterfaceSync } from "@/contexts/hooks/interface/sync";

import { useTabStreamingQuery } from '@/hooks/Query/useTabStreamingQuery';
import { showSuccessToast, showErrorToast } from "@/components/notifications";

/**
 * Debug flag for tab prefetching indicators
 * Set NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true to enable prefetched tab indicators
 */
const DEBUG_TAB_PREFETCHING = process.env.NEXT_PUBLIC_DEBUG_TAB_PREFETCHING === 'true';

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

    // Enhanced tab click handler with instant switching
    const handleTabClick = (tabName: string) => {
        // Only update the URL param, Interface.tsx's handleTabChange will handle the actual switching
        setTabQueryParam(tabName);
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
                setTabQueryParam(newTabName);
                showSuccessToast("Tab Created", `New tab "${newTabName}" was created successfully.`);
            }
        } catch (error) {
            // Error is handled by the lower-level `showErrorToast` utility
            console.error("Error creating tab:", error);
            showErrorToast("Failed to create tab. Please try again.", "Tab Creation Error");
        } finally {
            // Always reset pending state
            tabUIActions?.setPending(false);
        }
    };

    return (
        <div className="flex gap-4 items-center">
            {tabNamesToShow.length > 0 ? (
                <TabsList className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg justify-between">
                    <div className="flex flex-row gap-3">
                        {tabNamesToShow.map((tabNameToShow, idx) => {
                            return (
                                <TabsTrigger
                                    key={idx}
                                    value={tabNameToShow}
                                    className="relative flex flex-row gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold hover:bg-primary/10"
                                    
                                >
                                    <div className="h-5 w-16 text-center relative" onClick={() => handleTabClick(tabNameToShow)}>
                                        {tabNameToShow}
                                        {/* Cached data indicator for streaming - show if streaming enabled or if tab is prefetched */}
                                        {DEBUG_TAB_PREFETCHING && (() => {
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

                                </TabsTrigger>
                            );
                        })}
                        
                        {/* Add tab button integrated into tabs */}
                        <button
                            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            onClick={handleCreateTab}
                            disabled={tabUIState?.pending}
                            title="Add new tab"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </TabsList>
            ) : (
                /* When no tabs exist, show standalone add button with glass morphism */
                <div className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg p-2">
                    <button
                        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                        onClick={handleCreateTab}
                        disabled={tabUIState?.pending}
                        title="Add new tab"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            )}
        </div>
    )
};

export default InterfaceTabs;
