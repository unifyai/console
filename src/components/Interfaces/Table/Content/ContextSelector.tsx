"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { Context, ContextActions } from "@/types/evals/grid";
import { Braces, FolderTree, Grid2x2, X } from "lucide-react";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { ResponseProps } from "@/types/common";
import { useRouter } from "next/navigation";
import RenderMenuItems from "../../../Common/Dropdowns/RenderMenuItems";
import { buildNestedDropdownTree } from "@/utils/evals/common";
import { useTile } from "@/contexts/hooks/useTile";
import { useTableTile } from "@/contexts/hooks/useTableTile";
import { useMemo } from "react";
import { useProject } from "@/contexts/hooks/useProject";

const ContextSelector = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    contexts,
    context,
    setContext,
    button,
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
    contextActions: ContextActions,
    refresh: () => Promise<ResponseProps>,
    setPending: (pending: boolean) => void
}) => {
    const router = useRouter();
    const onDelete = () => {
        refresh().then(() => {
            router.refresh();
            setPending(true);
        });
    }

    const { dataActions: projectDataActions } = useProject(projectId || null);

    const { actions: tileActions, dataActions: tileDataActions } = useTile(tileId || null, tabId || null, interfaceId || null, projectId || null);

    const { 
        tableTile: tableTileState,
        actions: tableTileActions,
        uiActions: tableUIActions 
    } = useTableTile(tileId || null, tabId || null, interfaceId || null, projectId || null);

    const item = useMemo(() => tileActions?.asTileItem(), [tileActions]);
    
    const finalSetContext = (tileActions && tileDataActions && tableUIActions && item != undefined) ? (ctx: string) => {
        if (ctx !== item.context) {
            // Update the tile's column_context
            tableUIActions.setColumnContext("");

            // Update the tile's context
            tileDataActions.setContext(ctx);
        }
    } : setContext;
    
    const empty = contexts.length == 0 && tableTileState?.tableDataItem?.columnContexts?.length == 0;

    // Build and render the tree
    const contextNames = contexts.map(context => context.name).sort();

    // Find the largest common prefix among all contextNames
    let largestCommonPrefix = "";
    if (contextNames.length === 0) {
        largestCommonPrefix = "";
    } else if (contextNames.length === 1) {
        largestCommonPrefix = contextNames[0];
    } else {
        // Split the first context by '/' to get path segments
        const firstContextParts = contextNames[0].split('/');
        let commonParts: string[] = [];

        // Check each segment against all other contexts
        for (let i = 0; i < firstContextParts.length; i++) {
            let isCommon = true;
            const currentPath = firstContextParts.slice(0, i + 1).join('/');
            for (let j = 1; j < contextNames.length; j++) {
                if (!contextNames[j].startsWith(currentPath + (i < firstContextParts.length - 1 ? '/' : ''))) {
                    isCommon = false;
                    break;
                }
            }
            if (isCommon) commonParts = firstContextParts.slice(0, i + 1);
            else break;
        }
        largestCommonPrefix = commonParts.join('/');
    }

    // filter contexts based on the prefixes and construct the tree
    const contextPrefix = context || largestCommonPrefix;
    const contextTree = item == undefined
        ? largestCommonPrefix == "" ? buildNestedDropdownTree(contextNames) : buildNestedDropdownTree(
            contextNames.map(name => {
                const slicedName = name.slice(largestCommonPrefix.length)
                return slicedName == "" ? "<root>" : slicedName
            }).sort((a, b) => {
                if (a === "<root>") return -1;
                if (b === "<root>") return 1;
                return a.localeCompare(b);
            })
        ) : buildNestedDropdownTree(
            contextNames.filter(
                name => name.startsWith(contextPrefix)
            ).map(name => {
                const slicedName = name.slice(contextPrefix.length)
                return slicedName == "" ? "<root>" : slicedName
            }).sort((a, b) => {
                if (a === "<root>") return -1;
                if (b === "<root>") return 1;
                return a.localeCompare(b);
            })
        );
    const columnContextTree = buildNestedDropdownTree(tableTileState?.tableDataItem?.columnContexts || []);
    const contextHeader = item != undefined ? (
        contextPrefix == "" ? (context || "Context") : contextPrefix
    ) : (largestCommonPrefix == "" ? "Context" : largestCommonPrefix);

    return (
        <div className="w-fit">
            <BaseDropdown
                button={button || <ActionButton
                    tooltip={item == undefined ? "Edit Global Context" : "Edit Context and Column Context"}
                    icon={<FolderTree />}
                    variant={item == undefined && context ? "primary" : "outline"}
                    size="sm"
                    disabled={!projectId}
                />}
                open={!projectId ? false : undefined}
                setOpen={(isOpen) => {
                    if (isOpen && projectId && contextActions) {
                        contextActions.get(projectId).then(ctxs => projectDataActions?.setContexts(ctxs));
                    }
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
                                prefix={item == undefined ? largestCommonPrefix : contextPrefix}
                                attr={item != undefined ? item.context : context}
                                setter={(ctx: string) => finalSetContext && finalSetContext(ctx)}
                                isColumnContext={false}
                                deleteDialog={
                                    projectId ? <div onClick={(e) => e.stopPropagation()}>
                                        <DeleteDialog
                                            variant="warning"
                                            type={"context"}
                                            args={[projectId, context]}
                                            deletingFunction={contextActions.delete}
                                            onDelete={onDelete}
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
                                    onClick={() => tableUIActions?.setColumnContext("")}
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
                                setter={(value) => tableUIActions?.setColumnContext(value)}
                                deleteDialog={
                                    projectId ? <div onClick={(e) => e.stopPropagation()}>
                                        <DeleteDialog
                                            variant="warning"
                                            type={"context"}
                                            args={[projectId, context]}
                                            deletingFunction={contextActions.delete}
                                            onDelete={onDelete}
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
