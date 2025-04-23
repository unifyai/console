import DeleteDialog from "@/components/Common/Dialogs/Delete";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { useTableTile, useTile } from "@/contexts/hooks/tile";
import { useMemo } from "react";
import { useTabData } from "@/contexts/hooks/tab";
import { useProjectData } from "@/contexts/hooks/project";
import { Braces, CircleX, Grid2x2, X } from "lucide-react";
import { useTileItem } from "@/contexts/hooks/tile";
import { buildNestedDropdownTree, getFieldsByColumnContext } from "@/utils/evals/common";
import { useRouter } from "next/navigation";
import { Context, ContextActions, LogsActions } from "@/types/evals/grid";
import { ResponseProps } from "@/types/common";
import RenderMenuItems from "@/components/Common/Dropdowns/RenderMenuItems";
import { LogFieldsResponseProps } from "@/types/evals/logs";

const ContextContent = ({ projectId, tabId, interfaceId, tileId, contexts, context, setContext, refresh, setPending, contextActions, logsActions }: {
    projectId?: string,
    tabId?: string,
    interfaceId?: string,
    tileId?: string,
    contexts: Context[],
    context?: string,
    setContext?: (context: string) => void,
    refresh: () => Promise<ResponseProps>,
    setPending: (pending: boolean) => void,
    contextActions: ContextActions,
    logsActions: LogsActions
}) => {
    const router = useRouter();

    const { dataActions: projectDataActions } = useProjectData(projectId || null);
    const { dataActions: tabDataActions } = useTabData(tabId || null, interfaceId || null, projectId || null);
    const { actions: tileActions, dataActions: tileDataActions } = useTile(tileId || null, tabId || null, interfaceId || null, projectId || null);
    const { itemActions: tileItemActions } = useTileItem(tileId || null, tabId || null, interfaceId || null);

    const { 
        tableTile: tableTileState,
        tableTileActions,
    } = useTableTile(tileId || null, tabId || null, interfaceId || null, projectId || null);

    const item = useMemo(() => tileItemActions?.asTileItem(), [tileItemActions]);

    const finalSetContext = (tileActions && tileDataActions && tableTileActions && item != undefined) ? (ctx: string) => {
        if (ctx !== item.context) {
            // Update the tile's column_context
            tableTileActions.setColumnContext("");

            // Update the tile's context
            tileDataActions.setContext(ctx);
        }
    } : setContext;

    const empty = contexts.length == 0 && tableTileState?.tableDataItem?.columnContexts?.length == 0;

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
    const columnContextTree = buildNestedDropdownTree(tableTileState?.tableDataItem?.columnContexts || []);
    const contextHeader = (item != undefined && context != undefined) ? (
        context == "" ? (context || "Context") : context
    ) : "Context";

    const onDelete = (ctx: string) => {
        if (ctx) {
            tabDataActions?.removeContextFromTab(ctx);
        }

        refresh().then(() => {
            router.refresh();
            setPending(true);
        });
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
            {item && tileActions && tableTileActions && (tableTileState?.tableDataItem?.columnContexts) && tableTileState.tableDataItem.columnContexts.length > 0 && <div className="pt-2">
                <div className="font-bold text-sm px-2 pb-2 border-b flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                        <Grid2x2 size={18} /> Column Context
                    </div>
                    {item.column_context && <Tooltip content="Clear column context">
                        <X
                            size={18}
                            onClick={() => tableTileActions?.setColumnContext("")}
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
                        setter={(value) => tableTileActions?.setColumnContext(value)}
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
                                                tableTileState?.tableDataItem?.fields as LogFieldsResponseProps,
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
