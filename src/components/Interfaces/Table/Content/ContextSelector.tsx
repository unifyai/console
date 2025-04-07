"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { Context, ContextActions, LogsActions } from "@/types/evals/grid";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { Braces, FolderTree, Grid2x2, X } from "lucide-react";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { ResponseProps } from "@/types/common";
import { useRouter } from "next/navigation";
import RenderMenuItems from "../../../Common/Dropdowns/RenderMenuItems";
import { buildNestedDropdownTree, getFieldsByColumnContext } from "@/utils/evals/common";
import { useMemo, useState } from "react";

import { useTile, useTileItem } from "@/contexts/hooks/tile";
import { useTableTile } from "@/contexts/hooks/tile/useTableTile";
import { useProjectData } from "@/contexts/hooks/project";
import { useTabData } from "@/contexts/hooks/tab";

const ContextSelector = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    contexts,
    context,
    setContext,
    button,
    logsActions,
    contextActions,
    refresh,
    setPending
}: {
    tileId?: string,
    tabId?: string,
    interfaceId?: string,
    projectId?: string,
    contexts: Context[],
    context?: string,
    setContext?: (context: string) => void,
    button?: React.ReactNode,
    logsActions: LogsActions,
    contextActions: ContextActions,
    refresh: () => Promise<ResponseProps>,
    setPending: (pending: boolean) => void
}) => {
    const [open, setOpen] = useState(false);
    const [start, setStart] = useState(true);
    const router = useRouter();

    const { dataActions: projectDataActions } = useProjectData(projectId || null);
    const { dataActions: tabDataActions } = useTabData(tabId || null, interfaceId || null, projectId || null);
    const { actions: tileActions, dataActions: tileDataActions } = useTile(tileId || null, tabId || null, interfaceId || null, projectId || null);
    const { itemActions: tileItemActions } = useTileItem(tileId || null, tabId || null, interfaceId || null);

    const { 
        tableTile: tableTileState,
        tableTileActions,
    } = useTableTile(tileId || null, tabId || null, interfaceId || null, projectId || null);

    const emptyLogs = useMemo(() => {
        return tableTileState?.tableDataItem?.logs?.length == 0;
    }, [tableTileState?.tableDataItem?.logs]);

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
        <div className="w-fit">
            <BaseDropdown
                button={button || <ActionButton
                    tooltip={item == undefined ? "Edit Global Context" : "Edit Context and Column Context"}
                    icon={<FolderTree />}
                    variant={context ? "primary" : "outline"}
                    size="sm"
                    disabled={!projectId}
                />}
                open={!projectId ? false : open ? true :undefined}
                defaultOpen={item != undefined && context == undefined && emptyLogs}
                setOpen={(isOpen) => {
                    if (isOpen && projectId && contextActions) {
                        contextActions.get(projectId).then(ctxs => projectDataActions?.setContexts(ctxs));
                    }
                    if (start && isOpen && !open) {
                        setOpen(true);
                        setStart(false);
                    }
                    else setOpen(false);
                }}
            >
                <div className="flex flex-col gap-4">
                    {empty && <div className="text-center text-sm">No contexts found.</div>}
                    {contexts.length > 0 ? <div className="pt-2">
                        <div className="font-bold text-sm px-2 pb-2 border-b flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <Braces size={18} />
                                {contextHeader == "Context"
                                    ? contextHeader
                                    : <Tooltip content={contextHeader}>
                                        {contextHeader.length > 20 ? contextHeader.slice(0, 20) + "..." : contextHeader}
                                    </Tooltip>
                                }
                            </div>
                            {(item != undefined ? item.context : context) && <Tooltip content="Clear Context">
                                <X
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
                            {item.column_context && <Tooltip content="Clear Column Context">
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
            </BaseDropdown>
        </div>
    )
}

export default ContextSelector;
