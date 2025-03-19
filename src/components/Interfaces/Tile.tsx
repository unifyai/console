"use client";

// Use correct import paths as found in Card.tsx
import LogsTable from "@/components/Interfaces/Table/Table";
import LogsPlot from "@/components/Interfaces/Details/Plot/Plot";
import Selection from "@/components/Interfaces/Details/Selection/Selection";
import { ResponseProps } from "@/types/common";
import { LogsActions, FieldsActions, DerivedEntryActions, TileProps, ContextActions, TabProps } from "@/types/evals/grid";

// Import the new hooks
import { useTile } from '@/contexts/hooks/useTile';
import { ExpandProvider } from "@/contexts/ExpandContext";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Define component props 
interface TileComponentProps {
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId: string;
    updateTab: (savedTab?: TabProps | null, updatedTileProps?: TileProps[] | TileProps | null) => Promise<ResponseProps>;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    derivedEntryActions: DerivedEntryActions;
    contextActions: ContextActions;
}

const Tile = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    updateTab,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions
}: TileComponentProps) => {

    const router = useRouter();
    const [initial, setInitial] = useState(true);
    
    // Get tile data and actions from hooks with granular access
    const { 
        meta: tileMetaState,
        actions: tileActions,
        uiActions: tileUIActions
    } = useTile(tileId, tabId, interfaceId);

    // Get the item props for grid layout (position, etc)
    const tileItem: TileProps = useMemo(() => tileActions?.asTileItem() || {
        i: tileId,
        x: tileMetaState?.position?.x || 0,
        y: tileMetaState?.position?.y || 0,
        w: tileMetaState?.position?.width || 4,
        h: tileMetaState?.position?.height || 4,
    }, [tileActions, tileMetaState]);

    // Use a ref to compare the needed properties so we only update if something truly changed.
    useEffect(() => {
        if (tileItem.tab != "View" && !initial) {
            updateTab(null, tileItem).then(() => {
                router.refresh();
            }).catch(error => {
                console.error('Error updating interface:', error);
            });
        }
    }, [
        tileItem.tab,
        tileItem.table_type,
        tileItem.filters,
        tileItem.context,
        tileItem.column_context,
        tileItem.common_filter,
        tileItem.sorting,
        tileItem.grouping,
        tileItem.group_sorting,
        tileItem.page_number,
        tileItem.metric,
        tileItem.plot_type,
        tileItem.x_axis,
        tileItem.y_axis,
        tileItem.plot_group_by,
        tileItem.auto_update,
        tileItem.freeze
    ]);

    useEffect(() => {
        if (tileItem.tab != "View" && !initial)
            tileUIActions?.setPending(true);
    }, [tileItem.tab, tileItem.table_type, tileItem.context, tileItem.column_context]);

    useEffect(() => {
        setInitial(false);
    }, []);

    // Render based on tile type
    const renderContent = () => {
        switch (tileMetaState?.type) {
            case 'Table':
                return (
                    <LogsTable 
                        tileId={tileId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        updateTab={updateTab}
                    />
                );
            case 'Plot':
                return (
                    <LogsPlot 
                        tileId={tileId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                    />
                );
            case 'View':
                return (
                    <div className="w-full overflow-auto">
                        <ExpandProvider>
                            <Selection
                                tileId={tileId}
                                tabId={tabId}
                                interfaceId={interfaceId}
                                projectId={projectId}
                            />
                        </ExpandProvider>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        renderContent()
    );
};

export default Tile; 