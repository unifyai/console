"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { Context, ContextActions, ItemType, TableDataItem, LogsActions } from "@/types/evals/grid";
import { TileProps } from "@/types/evals/grid";
import { Braces, FolderTree, Grid2x2, X } from "lucide-react";
import { useState } from "react";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { ResponseProps } from "@/types/common";
import { useRouter } from "next/navigation";
import RenderMenuItems from "../../../Common/Dropdowns/RenderMenuItems";
import { buildNestedDropdownTree } from "@/utils/evals/common";

const ContextSelector = ({
    project,
    contexts_,
    tableDataItem,
    item,
    updateItem,
    context,
    setContext,
    button,
    contextActions,
    logsActions,
    fields,
    refresh,
    setPending
}: {
    project: string | undefined,
    contexts_: Context[],
    tableDataItem?: TableDataItem,
    item?: TileProps,
    updateItem?: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    context?: string,
    setContext?: (context: string) => void,
    button?: React.ReactNode,
    contextActions: ContextActions,
    logsActions: LogsActions,
    fields?: string[],
    refresh: () => Promise<ResponseProps>,
    setPending: (pending: boolean) => void
}) => {
    const [open, setOpen] = useState(false);
    const [start, setStart] = useState(true);
    const router = useRouter();
    const onDelete = () => {
        refresh().then(() => {
            router.refresh();
            setPending(true);
        });
    }

    const [contexts, setContexts] = useState<Context[]>(contexts_);
    const finalSetContext = (updateItem != undefined && item != undefined) ? (ctx: string) => {
        if (ctx != item.context) {
            updateItem(item, "column_context")("");
            updateItem(item, "context")(ctx);
        }
    } : setContext;
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

    return (
        <div className="w-fit">
            <BaseDropdown
                button={button || <ActionButton
                    tooltip={item == undefined ? "Edit Global Context" : "Edit Context and Column Context"}
                    icon={<FolderTree />}
                    variant={item == undefined && context ? "primary" : "outline"}
                    size="sm"
                    disabled={!project}
                />}
                open={!project ? false : open ? true :undefined}
                defaultOpen={item != undefined && context == undefined}
                setOpen={(isOpen) => {
                    if (isOpen && project && contextActions) {
                        contextActions.get(project).then(ctxs => setContexts(ctxs));
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
                                    project ? <div onClick={(e) => e.stopPropagation()}>
                                        <DeleteDialog
                                            variant="warning"
                                            type="context"
                                            args={[project, context]}
                                            deletingFunction={contextActions.delete}
                                            onDelete={onDelete}
                                            className="h-fit flex items-center"
                                        />
                                    </div> : <></>
                                }
                            />
                        ))}
                    </div> : <></>}
                    {item && updateItem && (tableDataItem != undefined) && tableDataItem.columnContexts && tableDataItem.columnContexts.length > 0 && <div className="pt-2">
                        <div className="font-bold text-sm px-2 pb-2 border-b flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <Grid2x2 size={18} /> Column Context
                            </div>
                            {item.column_context && <Tooltip content="Clear Column Context">
                                <X
                                    size={18}
                                    onClick={() => updateItem(item, "column_context")("")}
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
                                setter={updateItem(item, "column_context")}
                                deleteDialog={
                                    project ? <div onClick={(e) => e.stopPropagation()}>
                                        <DeleteDialog
                                            variant="warning"
                                            type={"context"}
                                            args={[project, context]}
                                            deletingFunction={contextActions.delete}
                                            onDelete={onDelete}
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
