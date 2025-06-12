"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { useMemo } from "react";
import { Braces, CircleX, Grid2x2, X } from "lucide-react";
import { useTileItem } from "@/contexts/hooks/tile";
import { buildNestedDropdownTree, getFieldsByColumnContext } from "@/utils/evals/common";
import { Context, ContextActions, LogsActions, GranularTabActions, GranularTileActions, ProjectsActions, FieldsActions } from "@/types/evals/grid";
import RenderMenuItems from "@/components/Common/Dropdowns/RenderMenuItems";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { useTabSync } from "@/contexts/hooks/tab/sync";
import { useTableDataQuery } from "@/hooks/Query/useTableDataQuery";
import { useTileSync } from "@/contexts/hooks/tile/sync";
import { useListContextsQuery } from "@/hooks/Query/useContextsQuery";

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
    // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTabActions } = useTabSync(
        tabId || null, 
        interfaceId || null, 
        serverTabActions, 
        serverTileActions,
    );
    const syncedTabDataActions = syncedTabActions?.data ?? null;

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

    // Use React Query to access tableDataItem
    const { 
        data: tableDataItem,
        isLoading: isTableDataLoading,
        isError: isTableDataError,
        error: tableDataError
    } = useTableDataQuery(tileId || null, tabId || null);

    const listContextsQuery = useListContextsQuery(projectId || null, contextActions);
    const contexts = listContextsQuery.data || [];

    const empty = contexts.length == 0 && tableDataItem?.columnContexts?.length == 0;

    // Build and render the tree
    const contextNames = contexts.map(context => context.name).sort();

    // filter contexts based on the prefixes and construct the tree
    const contextTree = (item == undefined || context == undefined)
        ? buildNestedDropdownTree(contextNames) : buildNestedDropdownTree(
            contextNames.filter(
                name => name.startsWith(context)
            ).map(name => {
                const slicedName = name.slice(context.length)
                return slicedName == "" ? "<root>" : slicedName
            }).sort((a, b) => {
                if (a === "<root>") return -1;
                if (b === "<root>") return 1;
                return a.localeCompare(b);
            })
        );
    const columnContextTree = buildNestedDropdownTree(tableDataItem?.columnContexts || []);
    const contextHeader = (item != undefined && context != undefined) ? (
        context == "" ? (context || "Context") : context
    ) : "Context";

    const onDelete = (ctx: string) => {
        if (ctx) {
            syncedTabDataActions?.removeContextFromTab(ctx);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {empty && <div className="text-center text-sm">No contexts found.</div>}
            {contexts.length > 0 ? <div className="pt-2">
                <div className="font-bold text-sm px-2 pb-2 mb-2 border-b flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                        <Braces size={18} />
                        {contextHeader == "Context"
                            ? contextHeader
                            : <Tooltip content={contextHeader}>
                                {contextHeader.length > 20 ? contextHeader.slice(0, 20) + "..." : contextHeader}
                            </Tooltip>
                        }
                    </div>
                    {(item != undefined ? item.context : context) && <Tooltip content="Clear context" side="bottom">
                        <CircleX
                            size={18}
                            onClick={() => finalSetContext && finalSetContext("")}
                            className="cursor-pointer hover:text-primary"
                        />
                    </Tooltip>}
                </div>
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
                        showRoot={item == undefined}
                        prefix={item == undefined ? "" : context}
                        attr={item != undefined ? item.context : context}
                        setter={(ctx: string) => finalSetContext && finalSetContext(ctx)}
                        isColumnContext={false}
                        loading={loading}
                        deleteDialog={
                            projectId ? <div onClick={(e) => e.stopPropagation()}>
                                <DeleteDialog
                                    variant="warning"
                                    type="context"
                                    args={[projectId, name !== "<root>" ? name : context ?? ""]}
                                    deletingFunction={contextActions.delete}
                                    onDelete={() => onDelete(name !== "<root>" ? name : context ?? "")}
                                    className="h-fit flex items-center"
                                />
                            </div> : <></>
                        }
                    />
                ))}
            </div> : <></>}
            {item && syncedTileDataActions && (tableDataItem?.columnContexts) && tableDataItem.columnContexts.length > 0 && <div className="pt-2">
                <div className="font-bold text-sm px-2 pb-2 border-b flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                        <Grid2x2 size={18} /> Column Context
                    </div>
                    {item.column_context && <Tooltip content="Clear column context">
                        <X
                            size={18}
                            onClick={() => syncedTileDataActions.setColumnContext("")}
                            className="cursor-pointer hover:text-primary"
                        />
                    </Tooltip>}
                </div>
                {Object.entries(columnContextTree.children).sort((a, b) => {
                    if (a[0] === "<root>") return -1;
                    if (b[0] === "<root>") return 1;
                    return a[0].localeCompare(b[0]);
                }).map(([name, node], idx) => (
                    <RenderMenuItems
                        key={idx}
                        node={node}
                        nodeName={name}
                        isTopLevel={true}
                        showRoot={true}
                        attr={item.column_context}
                        isColumnContext={true}
                        setter={(value) => syncedTileDataActions.setColumnContext(value)}
                        loading={loading}
                        deleteDialog={
                            projectId ? <div onClick={(e) => e.stopPropagation()}>
                                <DeleteDialog
                                    variant="warning"
                                    type={"context"}
                                    args={
                                        [
                                            projectId,
                                            context,
                                            getFieldsByColumnContext(
                                                tableDataItem?.fields as LogFieldsResponseProps,
                                                name !== "<root>" ? name : context ?? ""
                                            ).map(field => [null, field])
                                        ]
                                    }
                                    deletingFunction={logsActions.delete}
                                    onDelete={() => onDelete(name !== "<root>" ? name : context ?? "")}
                                    className="h-fit flex items-center"
                                />
                            </div> : <></>
                        }
                    />
                ))}
            </div>}
        </div>
    );
}

export default ContextContent;
