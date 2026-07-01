'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Folder, HardDrive, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/checkbox';
import { Switch } from '@/components/UI/switch';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Label } from '@/components/UI/label';
import { cn } from '@/lib/utils';
import { AssistantActions } from '@/types/assistants/assistant';
import { OAuthProvider } from '@/types/assistants/contact';
import { WorkspaceFileNode } from '@/types/assistants/workspace-files';
import { useWorkspaceFileAccess, NodeCheckState } from '@/hooks/Assistants/useWorkspaceFileAccess';
import {
  getAttachmentColor,
  getAttachmentIcon,
  getAttachmentType,
} from '@/components/Chat/attachmentUtils';
import type { AttachmentType } from '@/types/assistants/chat';

interface WorkspaceFileTreeProps {
  assistantId: string;
  provider: OAuthProvider;
  assistantActions: AssistantActions;
  isOpen: boolean;
  canWrite?: boolean;
}

interface TreeRowProps {
  node: WorkspaceFileNode;
  depth: number;
  childrenByKey: Record<string, WorkspaceFileNode[]>;
  expanded: Set<string>;
  loadingKeys: Set<string>;
  nodeState: (node: WorkspaceFileNode) => NodeCheckState;
  onToggleExpand: (node: WorkspaceFileNode) => void;
  onToggleNode: (node: WorkspaceFileNode) => void;
  keyOf: (driveId: string, itemId: string) => string;
  disabled: boolean;
}

function getWorkspaceFileType(node: WorkspaceFileNode): AttachmentType {
  const typeFromName = getAttachmentType(node.name);
  if (typeFromName !== 'generic') return typeFromName;

  const mimeType = node.mimeType?.toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return 'excel';
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'powerpoint';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'word';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript')) {
    return 'code';
  }
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('archive')) {
    return 'archive';
  }
  return 'generic';
}

function WorkspaceFileIcon({ node }: { node: WorkspaceFileNode }) {
  if (node.kind === 'drive') {
    return <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  if (node.kind === 'folder') {
    return <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }

  const fileType = getWorkspaceFileType(node);
  const Icon = getAttachmentIcon(fileType);
  return (
    <Icon
      className="h-4 w-4 shrink-0"
      style={{ color: getAttachmentColor(fileType) }}
      data-testid={`workspace-file-icon-${node.itemId}`}
    />
  );
}

const TreeRow: React.FC<TreeRowProps> = ({
  node,
  depth,
  childrenByKey,
  expanded,
  loadingKeys,
  nodeState,
  onToggleExpand,
  onToggleNode,
  keyOf,
  disabled,
}) => {
  const k = keyOf(node.driveId, node.itemId);
  const isContainer = node.kind === 'folder' || node.kind === 'drive';
  const isExpanded = expanded.has(k);
  const isLoading = loadingKeys.has(k);
  const children = childrenByKey[k] ?? [];
  const state = nodeState(node);

  return (
    <div data-testid={`workspace-file-node-${node.itemId}`}>
      <div
        className="hover:bg-muted/40 flex items-center gap-1.5 rounded-md py-1 pr-2"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {isContainer ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            data-testid={`workspace-file-expand-${node.itemId}`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}

        <Checkbox
          checked={state === 'checked' ? true : state === 'indeterminate' ? 'indeterminate' : false}
          onCheckedChange={() => onToggleNode(node)}
          disabled={disabled}
          className={cn(state === 'indeterminate' && 'opacity-70')}
          data-testid={`workspace-file-checkbox-${node.itemId}`}
        />

        <WorkspaceFileIcon node={node} />

        <span className="text-body min-w-0 flex-1 truncate" title={node.name}>
          {node.name}
        </span>
      </div>

      {isContainer && isExpanded && (
        <div>
          {children.length === 0 && !isLoading ? (
            <p
              className="text-caption py-1 text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
            >
              Empty
            </p>
          ) : (
            children.map((child) => (
              <TreeRow
                key={keyOf(child.driveId, child.itemId)}
                node={child}
                depth={depth + 1}
                childrenByKey={childrenByKey}
                expanded={expanded}
                loadingKeys={loadingKeys}
                nodeState={nodeState}
                onToggleExpand={onToggleExpand}
                onToggleNode={onToggleNode}
                keyOf={keyOf}
                disabled={disabled}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Post-OAuth picker for gating which Drive / SharePoint / OneDrive files and
 * folders the assistant may access. Folder selections are recursive; the
 * "new files accessible by default" switch controls items at undecided
 * locations (and newly-added files there).
 */
export function WorkspaceFileTree({
  assistantId,
  provider,
  assistantActions,
  isOpen,
  canWrite = true,
}: WorkspaceFileTreeProps) {
  const {
    roots,
    childrenByKey,
    expanded,
    loadingKeys,
    isLoading,
    isSaving,
    defaultAllow,
    setDefaultAllow,
    toggleExpand,
    nodeState,
    toggleNode,
    selectAll,
    deselectAll,
    isDirty,
    explicitDecisionCount,
    save,
    keyOf,
  } = useWorkspaceFileAccess({ assistantId, provider, assistantActions, isOpen });

  const disabled = !canWrite || isSaving;
  const ruleCountLabel =
    explicitDecisionCount === 0
      ? 'No custom rules'
      : `${explicitDecisionCount} custom rule${explicitDecisionCount === 1 ? '' : 's'}`;
  const modeDescription = defaultAllow
    ? 'Everything is accessible except unchecked files and folders.'
    : 'Only checked files and folders are accessible.';

  return (
    <div className="flex flex-col gap-3" data-testid="workspace-file-tree">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-label">File access</Label>
          <span
            className="text-caption text-muted-foreground"
            data-testid="workspace-file-rule-count"
          >
            {ruleCountLabel}
          </span>
        </div>
        <p className="text-caption text-muted-foreground">
          Choose which folders and files this assistant can access. Selecting a folder grants access
          to everything inside it.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={disabled}
            data-testid="workspace-file-select-all"
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={disabled}
            data-testid="workspace-file-deselect-all"
          >
            Deselect all
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex flex-col">
          <span className="text-body">New files accessible by default</span>
          <span className="text-caption text-muted-foreground">{modeDescription}</span>
        </div>
        <Switch
          checked={defaultAllow}
          onCheckedChange={setDefaultAllow}
          disabled={disabled}
          data-testid="workspace-file-default-toggle"
        />
      </div>

      <ScrollArea className="h-64 rounded-md border">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-caption">Loading your drives...</span>
          </div>
        ) : roots.length === 0 ? (
          <p className="text-caption p-4 text-muted-foreground">
            No drives found for this account.
          </p>
        ) : (
          <div className="py-1">
            {roots.map((root) => (
              <TreeRow
                key={keyOf(root.driveId, root.itemId)}
                node={root}
                depth={0}
                childrenByKey={childrenByKey}
                expanded={expanded}
                loadingKeys={loadingKeys}
                nodeState={nodeState}
                onToggleExpand={toggleExpand}
                onToggleNode={toggleNode}
                keyOf={keyOf}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {canWrite && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={!isDirty || isSaving}
            data-testid="workspace-file-save"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save file access
          </Button>
        </div>
      )}
    </div>
  );
}
