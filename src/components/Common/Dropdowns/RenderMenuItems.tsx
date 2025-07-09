import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/UI/dropdown-menu";
import { TreeNode } from "@/types/common";
import { Check, Folder, Loader2 } from "lucide-react";
import Tooltip from "@/components/Common/Misc/Tooltip";

const RenderMenuItems = ({ node, nodeName, isTopLevel, showRoot, attr, prefix, setter, isColumnContext, deleteDialog, loading }: {
    node: TreeNode,
    nodeName: string,
    isTopLevel: boolean,
    showRoot: boolean,
    attr: string | undefined,
    prefix?: string,
    isColumnContext?: boolean,
    setter: (context: string) => void,
    deleteDialog?: React.ReactNode,
    loading?: boolean
}) => {
    const hasChildren = Object.keys(node.children).length > 0;
    const nodePath = node.path;
    const nonRootNodePath = nodePath.slice(0, -1).replace("/<root>", "");

    const getDisplayText = () => {
        if (nodeName !== "<root>") {
            return nodeName;
        }
        return nonRootNodePath || prefix || (isColumnContext ? "All Columns" : "Root Context");
    };
    
    const displayText = getDisplayText();

    const Content = ({ isSubTrigger = false }: { isSubTrigger?: boolean }) => (
        <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {loading ? (
                    <Loader2 size={15} className="animate-spin flex-shrink-0" />
                ) : attr === nonRootNodePath ? (
                    <Check size={15} className="flex-shrink-0 text-primary" />
                ) : (
                    <div className="w-4 flex-shrink-0" />
                )}
                <Tooltip content={displayText} side="top">
                    <span className="truncate flex items-center gap-1">
                        {nodeName === "<root>" && <Folder size={16} className="flex-shrink-0" />}
                        {displayText}
                    </span>
                </Tooltip>
            </div>
            {!isSubTrigger && (
                <div className="flex-shrink-0">
                    {!loading && deleteDialog}
                </div>
            )}
        </>
    );

    // If this is a leaf node (no children)
    if (!hasChildren) {
        return (
            <DropdownMenuItem
                key={nodeName}
                onSelect={() => (
                    (nonRootNodePath !== attr) ? setter(nonRootNodePath) : setter("")
                )}
                className="flex w-full justify-between items-center cursor-pointer gap-2"
                disabled={loading}
            >
                <Content />
            </DropdownMenuItem>
        );
    }

    // If this is a parent node with children
    const isParentOfSelected = !!(attr && nonRootNodePath && attr.startsWith(nonRootNodePath + '/') && attr !== nonRootNodePath);
    return (
        <DropdownMenuGroup>
            <DropdownMenuSub defaultOpen={isParentOfSelected}>
                <DropdownMenuSubTrigger
                    className="flex w-full justify-between items-center cursor-pointer gap-2 hover:text-white data-[state=open]:text-white"
                    disabled={loading}
                >
                    <Content isSubTrigger={true} />
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent className="p-1 w-56">
                        {/* Make the current path selectable */}
                        {showRoot && (
                            <DropdownMenuItem
                                key={`${nodeName}-root`}
                                onSelect={() => (
                                    nonRootNodePath !== attr ? setter(nonRootNodePath) : setter("")
                                )}
                                className="flex w-full justify-between items-center cursor-pointer gap-2"
                                disabled={loading}
                            >
                                <Content />
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
                                prefix={nonRootNodePath}
                                setter={setter}
                                isColumnContext={isColumnContext}
                                loading={loading}
                            />
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        </DropdownMenuGroup>
    );
};

export default RenderMenuItems;