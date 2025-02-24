"use client";

import { DropdownMenuSubContent } from "@radix-ui/react-dropdown-menu";
import { DropdownMenuPortal } from "@radix-ui/react-dropdown-menu";
import { DropdownMenuSub } from "@radix-ui/react-dropdown-menu";
import { DropdownMenuGroup } from "@radix-ui/react-dropdown-menu";
import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuSubTrigger } from "../../../UI/dropdown-menu";
import { Context, ItemType, TableDataItem, TableDataProps } from "@/types/evals/grid";
import { TileProps } from "@/types/evals/grid";
import { Check, FolderTree } from "lucide-react";

const ContextSelector = ({
    contexts,
    tableDataItem,
    item,
    updateItem,
    context,
    setContext,
}: {
    contexts: Context[],
    tableDataItem?: TableDataItem,
    item?: TileProps,
    updateItem?: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    context?: string,
    setContext?: (context: string) => void,
}) => {
    const finalSetContext = (updateItem != undefined && item != undefined) ? updateItem(item, "context") : setContext;

    return (
        <div className="w-fit">
            <BaseDropdown
                button={<ActionButton
                    tooltip="Edit Context and Column Context"
                    icon={<FolderTree/>}
                    variant="outline"
                    size="sm"
                />}
            >
                <div className="flex flex-col gap-6 pt-2">
                    <div>
                        <div className="font-bold text-sm px-2 pb-2 border-b">Context:</div>
                        {contexts.length > 0 ? contexts.map((context_: Context) => <DropdownMenuItem
                            key={context_.name}
                            onSelect={() => ((item?.context || context) != context_.name) && (finalSetContext && finalSetContext(context_.name))}
                            className="w-64 justify-between"
                        >
                            {context_.name}{(
                                (item?.context || context) == context_.name
                            ) && <Check />}
                        </DropdownMenuItem>) : <></>}
                    </div>
                    {item && updateItem && (tableDataItem != undefined) && <div>
                        <div className="font-bold text-sm px-2 pb-2 border-b">Column Context:</div>
                        {/* Add None option at the root level */}
                        <DropdownMenuItem
                            onSelect={() => (item.column_context != "") && updateItem(item, "column_context")("")}
                            className="w-64 justify-between"
                        >
                            None{(item.column_context == undefined || item.column_context == "") && <Check />}
                        </DropdownMenuItem>
                        {(() => {
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

                            const RenderMenuItems = ({ node, nodeName, isTopLevel }: {
                                node: TreeNode,
                                nodeName: string,
                                isTopLevel?: boolean
                            }) => {
                                const hasChildren = Object.keys(node.children).length > 0;

                                if (!hasChildren) {
                                    return (
                                        <DropdownMenuItem
                                            onSelect={() => (
                                                (node.path.slice(0, -1) != item.column_context)
                                                && updateItem(item, "column_context")(node.path.slice(0, -1))
                                            )}
                                            className="w-64 justify-between"
                                        >
                                            {nodeName}{item.column_context == node.path.slice(0, -1) && <Check />}
                                        </DropdownMenuItem>
                                    );
                                }

                                return (
                                    <DropdownMenuGroup>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="hover:text-white data-[state=open]:text-white">
                                                {nodeName}
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    {/* Make the current path selectable with "root" label */}
                                                    {node.isComplete && (
                                                        <DropdownMenuItem
                                                            onSelect={() => (
                                                                (node.path.slice(0, -1) != item.column_context)
                                                                && updateItem(item, "column_context")(node.path.slice(0, -1))
                                                            )}
                                                        >
                                                            {isTopLevel ? "<root>" : nodeName}{item.column_context == node.path.slice(0, -1) && <Check />}
                                                        </DropdownMenuItem>
                                                    )}
                                                    {/* Render children */}
                                                    {Object.entries(node.children).map(([childName, childNode], idx) => (
                                                        <RenderMenuItems
                                                            key={idx}
                                                            node={childNode}
                                                            nodeName={childName}
                                                            isTopLevel={false}
                                                        />
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                    </DropdownMenuGroup>
                                );
                            };

                            // Build and render the tree
                            const tree = buildTree(tableDataItem?.columnContexts || []);
                            return Object.entries(tree.children).map(([name, node], idx) => (
                                <RenderMenuItems
                                    key={idx}
                                    node={node}
                                    nodeName={name}
                                    isTopLevel={true}
                                />
                            ));
                        })()}
                    </div>}
                </div>
            </BaseDropdown>
        </div>
    )
}

export default ContextSelector;
