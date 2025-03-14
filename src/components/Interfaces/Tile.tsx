"use client";

// Use correct import paths as found in Card.tsx
import LogsTable from "@/components/Interfaces/Table/Table";
import LogsPlot from "@/components/Interfaces/Details/Plot/Plot";
import Selection from "@/components/Interfaces/Details/Selection/Selection";
import { ResponseProps } from "@/types/common";
import { LogsActions, FieldsActions, DerivedEntryActions, TileProps, ItemType, ContextActions } from "@/types/evals/grid";
import { LogFieldsResponseProps, PlotArguments, TableArguments } from "@/types/evals/logs";

// Import the new hooks
import { useTile } from '@/contexts/hooks/useTile';
import { useTableTile } from '@/contexts/hooks/useTableTile';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { ExpandProvider } from "@/contexts/ExpandContext";
import { useTab } from "@/contexts/hooks/useTab";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInterface } from "@/contexts/hooks/useInterface";
import { useRouter } from "next/navigation";
import { useWhyDidYouUpdate } from "@/contexts/utils/sliceUtils";

// Define component props 
interface TileComponentProps {
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId: string;
    updateTab: (savedTab?: any) => Promise<ResponseProps>;
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
    
    // Get tile data and actions from hooks
    const { interface: interfaceData } = useInterface(interfaceId);
    const { tab: tabData, actions: tabActions } = useTab(tabId, interfaceId);
    const { tile: tileData, actions: tileActions } = useTile(tileId, tabId, interfaceId);
    const { tableTile: tableData } = useTableTile(tileId, tabId, interfaceId);
    
    // Get the active project to access contexts
    const activeProjectId = useStoreContext((s) => s.activeProjectId);
    const projectData = useStoreContext(
        state => activeProjectId ? state.projectsById[activeProjectId] : null
    );

    // Get the item props for grid layout (position, etc)
    const tileItem: TileProps = useMemo(() => tileActions?.asTileItem() || {
        i: tileId,
        x: tileData?.position?.x || 0,
        y: tileData?.position?.y || 0,
        w: tileData?.position?.width || 4,
        h: tileData?.position?.height || 4,
    }, [tileActions, tileData]);

    useWhyDidYouUpdate('TileItemEffect', [
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

    // Use a ref to compare the needed properties so we only update if something truly changed.
    useEffect(() => {
        if (tileItem.tab != "View" && !initial) {
            updateTab().then(() => {
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
            tileActions?.setPending(true);
    }, [tileItem.tab, tileItem.table_type, tileItem.context, tileItem.column_context]);

    useEffect(() => {
        setInitial(false);
    }, []);

    // Render based on tile type
    const renderContent = () => {
        switch (tileData?.type) {
            case 'Table':
                return (
                    <LogsTable 
                        tileId={tileId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        contexts={projectData?.contexts || []}
                        context_={tabData?.globalContext}
                        tableArguments={interfaceData?.tableArguments as unknown as TableArguments}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        filterExpression={interfaceData?.tableArguments[tileId]?.getLogs_parameters?.filter_expr || null}
                        sortingExpression={interfaceData?.tableArguments[tileId]?.getLogs_parameters?.sorting || null}
                        groupingExpression={interfaceData?.tableArguments[tileId]?.getLogs_parameters?.grouping || null}
                        groupSortingExpression={interfaceData?.tableArguments[tileId]?.getLogs_parameters?.group_sorting || null}
                        limit={tableData?.limit || 20}
                        offset={tableData?.offset || 0}
                        updateTab={updateTab}
                    />
                );
            case 'Plot':
                return (
                    <LogsPlot 
                        interactive={tabData?.interactive || true}
                        item={tileItem}
                        updateItem={(item: TileProps, attrName: ItemType) => (value: string | undefined) => {
                            tileActions?.updateTile({ [attrName]: value });
                        }}
                        project={projectId}
                        pending={tileData.pending}
                        tableNames={[]}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        plotDataItem_={tileData.plotData?.plotDataItem || {
                            plotLogs: [],
                            plotArguments: {} as PlotArguments,
                            plotFields: {} as LogFieldsResponseProps
                        }}
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