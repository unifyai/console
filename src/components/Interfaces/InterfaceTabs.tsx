"use client";

import { X } from "lucide-react";
import { Plus } from "lucide-react";
import { TabsList, TabsTrigger } from "../UI/tabs";
import { Input } from "../UI/input";
import { useEffect, useState, useMemo } from "react";
import ActionButton from "../Common/Buttons/Action";
import { GranularTabActions, TileProps } from "@/types/evals/grid";
import { defaultTiles } from "@/constants/logs";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useInterface } from "@/contexts/hooks/interface";
import { useTab } from "@/contexts/hooks/tab";
import { useQueryState } from "nuqs";
import { 
  useCreateTabQuery, 
  useUpdateTabQuery, 
  useDeleteTabQuery 
} from "@/hooks/Query/useTabsQuery";

const InterfaceTabs = ({ 
  interfaceId, 
  newCounter, 
  tabQueryParam, 
  tabActions, 
  setTabQueryParam 
}: {
    interfaceId: string,
    newCounter: number,
    tabQueryParam: string | null,
    tabActions: GranularTabActions,
    setTabQueryParam: (tabQueryParam: string | null) => void,
}) => {
    const [_, setTabQueryParamNoReload] = useQueryState("tab");
    const [tabQueryParamState, setTabQueryParamState] = useState(tabQueryParam || "");
    const [hoveredTab, setHoveredTab] = useState<string | undefined>();

    // Initialize React Query mutations
    const createTabMutation = useCreateTabQuery();
    const updateTabMutation = useUpdateTabQuery();
    const deleteTabMutation = useDeleteTabQuery();

    // Global states
    const project = useStoreContext((s) => s.activeProjectId);

    // Interface states and actions with granular access
    const { ui: interfaceUIState, dataActions: interfaceDataActions, uiActions: interfaceUIActions } = useInterface(interfaceId);

    const tabNames = interfaceDataActions?.getTabNames() || [];

    // Tab states and actions with granular access
    const { data: tabDataState, ui: tabUIState, uiActions: tabUIActions } = useTab(tabQueryParam || "");
    
    const context = tabDataState?.globalContext!;

    useEffect(() => {
        setTabQueryParamState(tabQueryParam || "");
    }, [tabQueryParam]);

    // Handle tab rename
    const handleRenameTab = async (oldName: string, newName: string) => {
        if (oldName === newName || tabNames.includes(newName)) {
            return;
        }

        try {
            // Use React Query mutation to update the tab
            await updateTabMutation.mutateAsync({
                interface_id: project as string,
                name: oldName,
                data: {
                    name: newName,
                    global_context: context,
                    color: tabUIState?.color
                },
                actions: tabActions
            });

            // Update local UI state
            interfaceDataActions?.renameTab(oldName, newName);
            setTabQueryParamNoReload(newName);
        } catch (error) {
            console.error("Error renaming tab:", error);
        }
    };

    // Handle tab deletion
    const handleDeleteTab = async (tabName: string) => {
        try {
            // Use React Query mutation to delete the tab
            await deleteTabMutation.mutateAsync({
                interface_id: project as string,
                name: tabName,
                actions: tabActions
            });

            // Update UI if deleting the active tab
            if (tabQueryParam === tabName) {
                interfaceUIActions?.setPending(true);
                const tabIdx = tabNames.indexOf(tabName);
                const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : tabNames.length > 1 ? 1 : -1;
                const nextTabName = nextTabIdx !== -1 ? tabNames[nextTabIdx] : null;
                setTabQueryParam(nextTabName);
            }

            // Update local state
            interfaceDataActions?.removeTab(tabName);
        } catch (error) {
            console.error("Error deleting tab:", error);
        }
    };

    // Handle tab creation
    const handleCreateTab = async () => {
        try {
            let initialIndex = tabNames.length + 1;
            while (tabNames.includes(`tab${initialIndex}`)) {
                initialIndex++;
            }
            const newTabName = `tab${initialIndex}`;

            // Use React Query mutation to create a new tab
            await createTabMutation.mutateAsync({
                interface_id: project as string,
                name: newTabName,
                data: {
                    global_context: context,
                    color: tabUIState?.color,
                    visible: true,
                    active: true
                },
                actions: tabActions
            });

            // Update local state
            interfaceDataActions?.addTab(tabQueryParam || "", newTabName);
            interfaceUIActions?.setPending(true);
            setTabQueryParam(newTabName);
            setTabQueryParamState(newTabName);
        } catch (error) {
            console.error("Error creating tab:", error);
        }
    };

    return (
        <div className="flex gap-4 px-4">
            {tabNames.length > 0 && <TabsList className="rounded-md justify-between">
                <div className="flex flex-row gap-3">
                    {tabNames.map((tab_, idx) => <TabsTrigger
                        key={idx}
                        value={tab_}
                        className="relative flex flex-row gap-2 data-[state=active]:text-accent"
                        onMouseEnter={() => setHoveredTab(tab_)}
                        onMouseLeave={() => setHoveredTab(undefined)}
                    >
                        {tabQueryParam == tab_ ? <Input
                            value={tabQueryParamState}
                            disabled={interfaceUIState?.pending || interfaceUIState?.dataPending || updateTabMutation.isPending}
                            onInput={(event: React.ChangeEvent<HTMLInputElement>) => setTabQueryParamState(event.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && tab_ != tabQueryParamState && !tabNames.includes(tabQueryParamState)) {
                                    handleRenameTab(tab_, tabQueryParamState);
                                }
                                else if (e.key == "Enter" && tab_ == tabQueryParamState)
                                    setTabQueryParamState(tab_);
                            }}
                            className="px-0 h-5 w-16 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                        /> : <div className="h-5 w-16 text-center" onClick={() => setTabQueryParam(tab_)}>{tab_}</div>}
                        <div
                            className={`z-10 absolute -top-1 -right-1 cursor-pointer mb-auto hover:text-white hover:bg-primary rounded-sm ${hoveredTab == tab_ ? "opacity-100" : "opacity-0"}`}
                            onMouseEnter={() => tabQueryParam != tab_ && tabUIActions?.setDeleting(true)}
                            onMouseLeave={() => tabQueryParam != tab_ && tabUIActions?.setDeleting(false)}
                            onClick={() => handleDeleteTab(tab_)}
                        >
                            <X size={14} />
                        </div>
                    </TabsTrigger>)}
                </div>
            </TabsList>}
            <div className="flex gap-2">
                <ActionButton
                    variant="outline"
                    icon={<Plus />}
                    tooltip={"Add new tab"}
                    disabled={interfaceUIState?.pending || createTabMutation.isPending}
                    onClick={handleCreateTab}
                />
            </div>
        </div>
    )
};

export default InterfaceTabs;
