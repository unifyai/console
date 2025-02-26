"use client";

import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSub, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSubTrigger } from "../../../UI/dropdown-menu";
import { Context, ItemType, TableDataItem } from "@/types/evals/grid";
import { TileProps } from "@/types/evals/grid";
import { Braces, Check, Folder, FolderTree, Grid2x2 } from "lucide-react";

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
    const finalSetContext = (updateItem != undefined && item != undefined) ? updateItem(item, "context") : setContext;

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

    const RenderMenuItems = ({ node, nodeName, isTopLevel, showRoot, attr, setter }: {
        node: TreeNode,
        nodeName: string,
        isTopLevel: boolean,
        showRoot: boolean,
        attr: string | undefined,
        setter: (context: string) => void
    }) => {
        const hasChildren = Object.keys(node.children).length > 0;

        // If this is a leaf node (no children)
        if (!hasChildren && item != undefined) {
            return (
                <DropdownMenuItem
                    key={nodeName}
                    onSelect={() => (
                        (node.path.slice(0, -1) != attr)
                            ? setter(node.path.slice(0, -1))
                            : setter("")
                    )}
                    className="w-48 justify-between"
                >
                    {nodeName}{attr == node.path.slice(0, -1) && <Check />}
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
                            {node.isComplete && item != undefined && showRoot && (
                                <DropdownMenuItem
                                    key={nodeName}
                                    onSelect={() => (
                                        (node.path.slice(0, -1) != attr)
                                            ? setter(node.path.slice(0, -1))
                                            : setter("")
                                    )}
                                    className="w-48 justify-between"
                                >
                                    {isTopLevel ? <Folder className="w-4 h-4" /> : nodeName}{attr == node.path.slice(0, -1) && <Check />}
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
    const contextTree = buildTree(contexts.map(context => context.name));
    const columnContextTree = buildTree(tableDataItem?.columnContexts || []);

    return (
        <div className="w-fit">
            <BaseDropdown
                button={button || <ActionButton
                    tooltip="Edit Context and Column Context"
                    icon={<FolderTree />}
                    variant="outline"
                    size="sm"
                />}
            >
                <div className="flex flex-col gap-4">
                    {contexts.length > 0 ? <div className="pt-2">
                        <div className="font-bold text-sm px-2 pb-2 border-b flex gap-2 items-center">
                            <Braces size={18} /> Context
                        </div>
                        {Object.entries(contextTree.children).map(([name, node], idx) => (
                            <RenderMenuItems
                                key={idx}
                                node={node}
                                nodeName={name}
                                isTopLevel={true}
                                showRoot={true}
                                attr={item?.context || context}
                                setter={(ctx: string) => finalSetContext && finalSetContext(ctx)}
                            />
                        ))}
                    </div> : <></>}
                    {item && updateItem && (tableDataItem != undefined) && tableDataItem.columnContexts && tableDataItem.columnContexts.length > 0 && <div className="pt-2">
                        <div className="font-bold text-sm px-2 pb-2 border-b flex gap-2 items-center">
                            <Grid2x2 size={18} /> Column Context
                        </div>
                        {Object.entries(columnContextTree.children).map(([name, node], idx) => (
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
