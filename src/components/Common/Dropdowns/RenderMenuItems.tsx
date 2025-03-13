import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/UI/dropdown-menu";
import { TreeNode } from "@/types/common";
import { Check, Folder } from "lucide-react";

const RenderMenuItems = ({ node, nodeName, isTopLevel, showRoot, attr, prefix, setter, isColumnContext, deleteDialog }: {
    node: TreeNode,
    nodeName: string,
    isTopLevel: boolean,
    showRoot: boolean,
    attr: string | undefined,
    prefix?: string,
    isColumnContext?: boolean,
    setter: (context: string) => void,
    deleteDialog?: React.ReactNode
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

                {/* Delete context / column context */}
                {deleteDialog && deleteDialog}

            </DropdownMenuItem>
        );
    }

    // If this is a parent node with children
    return (
        <DropdownMenuGroup className="w-48">
            <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:text-white data-[state=open]:text-white">
                    <div className="w-4"/>
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
                                isColumnContext={isColumnContext}
                            />
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        </DropdownMenuGroup>
    );
};

export default RenderMenuItems;
