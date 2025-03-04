"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSub, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSubTrigger } from "../../../UI/dropdown-menu";
import { Context, ContextActions, ItemType, TableDataItem, LogsActions } from "@/types/evals/grid";
import { TileProps } from "@/types/evals/grid";
import { Braces, Check, Folder, FolderTree, Grid2x2, X, Trash } from "lucide-react";
import { useState } from "react";
import DeleteDialog from "@/components/Common/Dialogs/Delete";

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
    fields
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
    fields: string[]
}) => {
    const [contexts, setContexts] = useState<Context[]>(contexts_);
    const finalSetContext = (updateItem != undefined && item != undefined) ? (ctx: string) => {
        if (ctx != item.context) {
            updateItem(item, "column_context")("");
            updateItem(item, "context")(ctx);
        }
    } : setContext;
    const empty = contexts.length == 0 && tableDataItem?.columnContexts?.length == 0;

    interface TreeNode {
        path: string;
        children: { [key: string]: TreeNode };
        isComplete: boolean;
    }

    const buildTree = (paths: string[]) => {
        const root: TreeNode = { path: '', children: {}, isComplete: false };

        paths.forEach(path => {
            let current = root;
            const parts = path.split('/').filter(Boolean);

            let currentPath = '';
            parts.forEach((part, index) => {
                currentPath += part + '/';
                if (!current.children[part]) {
                    current.children[part] = {
                        path: currentPath,
                        children: {},
                        isComplete: index === parts.length - 1
                    };
                }
                current = current.children[part];
            });
        });

        return root;
    };

    const RenderMenuItems = ({ node, nodeName, isTopLevel, showRoot, attr, prefix, setter, isColumnContext, project }: {
        node: TreeNode,
        nodeName: string,
        isTopLevel: boolean,
        showRoot: boolean,
        attr: string | undefined,
        prefix?: string,
        isColumnContext?: boolean,
        project: string | undefined,
        setter: (context: string) => void
    }) => {
        const hasChildren = Object.keys(node.children).length > 0;
        const nodePath = prefix ? `${prefix}/${node.path}` : node.path;
        const nonRootNodePath = nodePath.slice(0, -1).replace("/<root>", "");

        // If this is a leaf node (no children)
        if (!hasChildren) {
            return (
                <DropdownMenuItem
                    key={nodeName}
                    onSelect={() => (
                        (nonRootNodePath != attr) ? setter(nonRootNodePath) : setter("")
                    )}
                    className="w-48 justify-between items-center"
                >
                    <div className="flex flex-row gap-2 items-center">
                        {attr == nonRootNodePath ? <Check size={15}/> : <div className="w-4"/>}
                        {nodeName == "<root>"
                            ? <span className="flex items-center gap-1">
                                <Folder size={16} />
                            </span>
                            : nodeName
                        }
                    </div>
                    {project && 
                        <div onClick={(e) => e.stopPropagation()}>
                            <DeleteDialog 
                                variant="warning" 
                                type={isColumnContext ? "column context" : "context"} 
                                args={isColumnContext ? [project, context, fields.filter(field => field.startsWith(nodePath)).map(field => ([null, field])), "all"]: [project, context]} 
                                deletingFunction={isColumnContext ? logsActions.delete : contextActions.delete}
                            />
                        </div>
                    }
                </DropdownMenuItem>
            );
        }

        // If this is a parent node with children
        return (
            <DropdownMenuGroup className="w-48">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="hover:text-white data-[state=open]:text-white">
                        {nodeName}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            {/* Make the current path selectable */}
                            {showRoot && (
                                <DropdownMenuItem
                                    key={`${nodeName}-root`}
                                    onSelect={() => (
                                        nonRootNodePath != attr ? setter(nonRootNodePath) : setter("")
                                    )}
                                    className="w-48 justify-between"
                                >
                                    <div className="flex flex-row gap-2 items-center">
                                        {attr == nonRootNodePath ? <Check size={15}/> : <div className="w-4"/>}
                                        {isTopLevel
                                            ? <span className="flex items-center gap-1">
                                                <Folder size={16} />
                                            </span>
                                            : nodeName
                                        }
                                    </div> 
                                </DropdownMenuItem>
                            )}
                            {/* Render all child nodes */}
                            {Object.entries(node.children).map(([childName, childNode], idx) => (
                                <RenderMenuItems
                                    key={idx}
                                    node={childNode}
                                    nodeName={childName}
                                    isTopLevel={false}
                                    showRoot={showRoot}
                                    attr={attr}
                                    prefix={prefix}
                                    setter={setter}
                                    project={project}
                                    isColumnContext={isColumnContext}
                                />
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
            </DropdownMenuGroup>
        );
    };

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
        ? largestCommonPrefix == "" ? buildTree(contextNames) : buildTree(
            contextNames.map(name => {
                const slicedName = name.slice(largestCommonPrefix.length)
                return slicedName == "" ? "<root>" : slicedName
            }).sort((a, b) => {
                if (a === "<root>") return -1;
                if (b === "<root>") return 1;
                return a.localeCompare(b);
            })
        ) : buildTree(
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
    const columnContextTree = buildTree(tableDataItem?.columnContexts || []);
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
                    disabled={!project}
                />}
                open={!project ? false : undefined}
                setOpen={(isOpen) => {
                    if (isOpen && project && contextActions) {
                        contextActions.get(project).then(ctxs => setContexts(ctxs));
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
                                project={project}
                                isColumnContext={false}
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
                                project={project}
                            />
                        ))}
                    </div>}
                </div>
            </BaseDropdown>
        </div>
    )
}

export default ContextSelector;
