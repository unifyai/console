import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/UI/dropdown-menu';
import { TreeNode } from '@/types/common';
import { Check, Folder, Loader2 } from 'lucide-react';
import Tooltip from '@/components/Common/Misc/Tooltip';

const RenderMenuItems = ({
  node,
  nodeName,
  isTopLevel,
  attr,
  prefix,
  setter,
  isColumnContext,
  deleteDialog,
  loading,
  rootDisplayName,
  selectableNodes,
}: {
  node: TreeNode;
  nodeName: string;
  isTopLevel: boolean;
  attr: string | undefined | null;
  prefix?: string;
  isColumnContext?: boolean;
  setter: (context: string) => void;
  deleteDialog?: React.ReactNode;
  loading?: boolean;
  rootDisplayName?: string;
  selectableNodes: string[];
}) => {
  const hasChildren = Object.keys(node.children).length > 0;
  const nodePath = node.path;
  const nonRootNodePath = nodePath.slice(0, -1).replace('/<root>', '');

  const isSelectable = selectableNodes.includes(nonRootNodePath);

  const getDisplayText = () => {
    if (nodeName !== '<root>') {
      return nodeName;
    }
    return (
      nonRootNodePath ||
      prefix ||
      rootDisplayName ||
      (isColumnContext ? 'All Columns' : 'Root Context')
    );
  };

  const maxChars = 25;
  const displayText = getDisplayText();
  const truncatedText =
    displayText.length > maxChars ? displayText.slice(0, maxChars) + '...' : displayText;

  const Content = () => (
    <div className="flex w-full items-center justify-between gap-2 text-start">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {loading ? (
          <Loader2 size={12} className="flex-shrink-0 animate-spin" />
        ) : attr === nonRootNodePath ? (
          <Check size={12} className="flex-shrink-0 text-primary" />
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}
        <Tooltip content={displayText} side="top">
          <span className="text-body-sm">{truncatedText}</span>
        </Tooltip>
      </div>
      <div className="flex-shrink-0">{!loading && deleteDialog}</div>
    </div>
  );

  if (!hasChildren) {
    return (
      <DropdownMenuItem
        key={nodeName}
        onSelect={() => (nonRootNodePath !== attr ? setter(nonRootNodePath) : setter(''))}
        className="text-body-sm flex w-full cursor-pointer items-center justify-between gap-2"
        disabled={loading}
      >
        <Content />
      </DropdownMenuItem>
    );
  }

  const isParentOfSelected = !!(
    attr &&
    nonRootNodePath &&
    attr.startsWith(nonRootNodePath + '/') &&
    attr !== nonRootNodePath
  );

  return (
    <DropdownMenuGroup>
      <DropdownMenuSub defaultOpen={isParentOfSelected}>
        <DropdownMenuSubTrigger
          className={`text-body-sm flex w-full items-center gap-2 hover:text-accent-foreground data-[state=open]:text-accent-foreground ${isSelectable ? 'cursor-pointer' : 'cursor-default'}`}
          disabled={loading}
          onClick={(e) => {
            if (isSelectable) {
              e.preventDefault();
              nonRootNodePath !== attr ? setter(nonRootNodePath) : setter('');
            }
          }}
        >
          <Content />
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            {Object.entries(node.children).map(([childName, childNode], idx) => (
              <RenderMenuItems
                key={idx}
                node={childNode}
                nodeName={childName}
                isTopLevel={false}
                attr={attr}
                prefix={nonRootNodePath}
                setter={setter}
                isColumnContext={isColumnContext}
                loading={loading}
                selectableNodes={selectableNodes}
              />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
};

export default RenderMenuItems;
