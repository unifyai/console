"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSub, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSubTrigger } from "../../../UI/dropdown-menu";
import { Context, ItemType, TableDataItem } from "@/types/evals/grid";
import { TileProps } from "@/types/evals/grid";
import { Braces, Check, Folder, FolderTree, Grid2x2, X } from "lucide-react";

const ContextSelector = ({
    contexts,
    tableDataItem,
    item,
    updateItem,
    context,
    setContext,
    button,
}: {
    contexts: Context[],
    tableDataItem?: TableDataItem,
    item?: TileProps,
    updateItem?: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    context?: string,
    setContext?: (context: string) => void,
    button?: React.ReactNode,
}) => {
    const finalSetContext = (updateItem != undefined && item != undefined) ? (ctx: string) => {
        if (ctx != item.context) {
            updateItem(item, "column_context")("");
            updateItem(item, "context")(ctx);
        }
    } : setContext;
    const disabled = !contexts.length && !tableDataItem?.columnContexts?.length;

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

    const RenderMenuItems = ({ node, nodeName, isTopLevel, showRoot, attr, prefix, setter }: {
        node: TreeNode,
        nodeName: string,
        isTopLevel: boolean,
        showRoot: boolean,
        attr: string | undefined,
        prefix?: string,
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
                    className="w-48 justify-between"
                >
                    {nodeName == "<root>"
                        ? <span className="flex items-center gap-1">
                            <Folder size={16} />
                        </span>
                        : nodeName
                    }{attr == nonRootNodePath && <Check />}
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
                                    {isTopLevel
                                        ? <span className="flex items-center gap-1">
                                            <Folder size={16} />
                                        </span>
                                        : nodeName
                                    }{attr == nonRootNodePath && <Check />}
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
        // Since contextNames are sorted alphabetically, we only need to compare the first and last entries
        // to find the largest common prefix
        const first = contextNames[0];
        const last = contextNames[contextNames.length - 1];
        let i = 0;

        // Find how many characters match at the beginning
        while (i < first.length && i < last.length && first.charAt(i) === last.charAt(i)) {
            i++;
        }

        // Make sure we don't cut in the middle of a path segment
        let lastSlashPos = first.substring(0, i).lastIndexOf('/');
        if (lastSlashPos === -1) {
            // If there's no slash in the common part, check if the entire first string matches
            if (i === first.length) {
                largestCommonPrefix = first;
            } else {
                largestCommonPrefix = "";
            }
        } else {
            largestCommonPrefix = first.substring(0, lastSlashPos + 1);
        }
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
                    disabled={disabled}
                />}
                open={disabled ? false : undefined}
            >
                <div className="flex flex-col gap-4">
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
                                setter={updateItem(item, "column_context")}
                            />
                        ))}
                    </div>}
                </div>
            </BaseDropdown>
        </div>
    )
}

export default ContextSelector;
