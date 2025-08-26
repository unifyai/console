"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { useMemo, useState } from "react";
import { CircleX, Grid2x2, X } from "lucide-react";
import { useTileItem } from "@/contexts/hooks/tile";
import { buildNestedDropdownTree, getFieldsByColumnContext } from "@/utils/interfaces/common";
import { Context, ContextActions, LogsActions, GranularTabActions, GranularTileActions, ProjectsActions, FieldsActions } from "@/types/interfaces/grid";
import RenderMenuItems from "@/components/Common/Dropdowns/RenderMenuItems";
import { LogFieldsResponseProps } from "@/types/interfaces/logs";
import { useTableDataQuery } from "@/hooks/Interfaces/Query/useTableDataQuery";
import { useTileSync } from "@/contexts/hooks/tile/sync";
import { useListContextsQuery } from "@/hooks/Interfaces/Query/useContextsQuery";
import { Input } from "@/components/UI/input";

const ContextContent = ({
    projectId,
    tabId,
    interfaceId,
    tileId,
    context,
    setContext,
    setPending,
    contextActions,
    logsActions,
    tabActions: serverTabActions,
    tileActions: serverTileActions,
    projectsActions,
    fieldsActions,
    loading,
}: {
    projectId?: string,
    tabId?: string,
    interfaceId?: string,
    tileId?: string,
    context?: string,
    setContext?: (context: string) => void,
    setPending: (pending: boolean) => void,
    contextActions: ContextActions,
    logsActions: LogsActions,
    tabActions?: GranularTabActions,
    tileActions?: GranularTileActions,
    projectsActions?: ProjectsActions,
    fieldsActions?: FieldsActions,
    loading?: boolean
}) => {

    const [searchQuery, setSearchQuery] = useState("");

    // SYNCHRONISED TABLE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTileActions } = useTileSync(
        tileId || null,
        tabId || null,
        serverTileActions,
        projectsActions,
        contextActions,
        logsActions,
        fieldsActions
    );
    const syncedTileDataActions = syncedTileActions?.data ?? null;

    const { itemActions: tileItemActions } = useTileItem(tileId || null, tabId || null);
    const item = useMemo(() => tileItemActions?.asTileItem(), [tileItemActions]);

    const finalSetContext = (syncedTileDataActions && item != undefined) ? (ctx: string) => {
        if (ctx !== item.context) {
            // Update the tile's context and column_context
            syncedTileDataActions.setContextAndColumnContext(ctx, "");
        }
    } : setContext;

    const listContextsQuery = useListContextsQuery(projectId || null, contextActions);
    const contexts = listContextsQuery.data || [];

    const contextNames = useMemo(() => contexts.map(context => context.name).sort(), [contexts]);
    
    const filteredGlobalContexts = useMemo(() => {
        if (!searchQuery) return contextNames;
        return contextNames.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [contextNames, searchQuery]);

    const empty = filteredGlobalContexts.length === 0;

    // Build and render the tree
    const contextTree = buildNestedDropdownTree(filteredGlobalContexts);

    return (
        <div className="flex flex-col gap-2">
            <div className="p-2 border-b border-border">
                <Input
                    placeholder="Search contexts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8"
                />
            </div>

            {empty && (
                <div className="text-center text-sm py-2 px-2">
                    {searchQuery ? "No contexts match your search." : "No contexts found."}
                </div>
            )}
            
            {filteredGlobalContexts.length > 0 ? <div>
                {Object.entries(contextTree.children).sort((a, b) => {
                    if (a[0] === "<root>") return -1;
                    if (b[0] === "<root>") return 1;
                    return a[0].localeCompare(b[0]);
                }).map(([name, node], idx) => (
                    <RenderMenuItems
                        key={idx}
                        node={node}
                        nodeName={name}
                        isTopLevel={true}
                        prefix={""}
                        attr={item != undefined ? item.context : context}
                        setter={(ctx: string) => finalSetContext && finalSetContext(ctx)}
                        isColumnContext={false}
                        loading={loading}
                        selectableNodes={contextNames}
                    />
                ))}
            </div> : <></>}
        </div>
    );
}

export default ContextContent;