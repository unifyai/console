'use client';

import React, { useMemo, useState } from 'react';
import { buildNestedDropdownTree } from '@/utils/interfaces/common';
import { TreeNode } from '@/types/common';
import { Input } from '@/components/UI/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/UI/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { useState as useReactState } from 'react';
import {
  useRenameContextQuery,
  useDeleteContextQuery,
} from '@/hooks/Interfaces/Query/useContextsQuery';

export default function ContextTreePicker({
  contexts,
  current,
  basePrefix,
  onPick,
  className,
  inherited,
  projectId,
  contextActions,
  hideClear,
}: {
  contexts: string[];
  current?: string | null;
  basePrefix?: string;
  onPick: (ctx: string) => void;
  className?: string;
  inherited?: string | null;
  projectId?: string;
  contextActions?: any;
  hideClear?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const { mutate: renameContext } = useRenameContextQuery();
  const { mutate: deleteContext } = useDeleteContextQuery();

  const inheritedCtx = useMemo(() => {
    const val = typeof inherited === 'string' ? inherited : undefined;
    if (val && val.trim() !== '') return val;
    if (basePrefix && basePrefix.trim() !== '') return basePrefix;
    return undefined;
  }, [inherited, basePrefix]);

  const namesWithinBase = useMemo(() => {
    if (!basePrefix || basePrefix.trim() === '') return contexts;
    const p = basePrefix.endsWith('/') ? basePrefix : `${basePrefix}/`;
    // Show the basePrefix node and ALL of its children; do not restrict to current tab context
    return contexts.filter((n) => n === basePrefix || n.startsWith(p));
  }, [contexts, basePrefix]);

  const filtered = useMemo(() => {
    if (!query) return namesWithinBase;
    const q = query.toLowerCase();
    return namesWithinBase.filter((n) => n.toLowerCase().includes(q));
  }, [namesWithinBase, query]);

  const root = useMemo(() => buildNestedDropdownTree(filtered), [filtered]);

  const subtree = useMemo(() => {
    if (!basePrefix || basePrefix.trim() === '') return root;
    const parts = basePrefix.split('/').filter(Boolean);
    let node: TreeNode = root;
    for (const part of parts) {
      const next = node.children[part];
      if (!next) return node; // fallback if base not found
      node = next;
    }
    return node;
  }, [root, basePrefix]);

  return (
    <div className={className}>
      {(current || inheritedCtx) && (
        <div className="text-body-sm space-y-1 border-b border-border px-2 py-1.5 text-muted-foreground">
          {current && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="truncate">
                Current context:{' '}
                <span className="text-foreground" title={current}>
                  {current}
                </span>
              </span>
              {projectId && contextActions && (
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-auto h-6 w-6">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(() => {
                      const isTwinTasks =
                        projectId === 'Twin' && String(current).trim() === 'Tasks';
                      return (
                        <>
                          <DropdownMenuItem
                            onSelect={() => {
                              setNewName(current || '');
                              setRenameOpen(true);
                            }}
                            disabled={isTwinTasks}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDeleteOpen(true)}
                            className="text-destructive"
                            disabled={isTwinTasks}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      );
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
          {inheritedCtx && (!current || inheritedCtx !== current) && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="truncate">
                Inherited context:{' '}
                <span className="text-foreground" title={inheritedCtx}>
                  {inheritedCtx}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
      <div className="border-b border-border p-2">
        <Input
          placeholder="Search contexts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-80 overflow-auto p-2">
        <Accordion type="multiple" className="w-full">
          {basePrefix && basePrefix.trim() !== '' ? (
            <TreeRow node={subtree} depth={0} current={current || undefined} onPick={onPick} />
          ) : (
            Object.entries(subtree.children)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([name, child]) => (
                <TreeRow
                  key={child.path}
                  node={child}
                  depth={0}
                  current={current || undefined}
                  onPick={onPick}
                />
              ))
          )}
        </Accordion>
      </div>
      {current && !hideClear && (
        <div className="border-t border-border px-2 py-1">
          <button
            type="button"
            className="text-body-sm h-6 rounded px-2 hover:bg-accent"
            onClick={() => onPick('')}
          >
            Clear selection
          </button>
        </div>
      )}

      {projectId && contextActions && (
        <>
          {renameOpen && (
            <BaseDialog
              button={null as any}
              open={renameOpen}
              setOpen={setRenameOpen}
              title={`Rename context`}
              body={
                <div className="space-y-2 pt-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New context name"
                  />
                </div>
              }
              footer={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRenameOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      renameContext({
                        projectId,
                        currentName: current as string,
                        newName,
                        actions: contextActions,
                      });
                      setRenameOpen(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              }
            />
          )}
          {deleteOpen && (
            <BaseDialog
              button={null as any}
              open={deleteOpen}
              setOpen={setDeleteOpen}
              title={`Delete context`}
              body={
                <div className="pt-2">Are you sure you want to delete &quot;{current}&quot;?</div>
              }
              footer={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      deleteContext({
                        projectId,
                        contextName: current as string,
                        actions: contextActions,
                      });
                      setDeleteOpen(false);
                      onPick('');
                    }}
                  >
                    Delete
                  </Button>
                </div>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  current,
  onPick,
}: {
  node: TreeNode;
  depth: number;
  current?: string;
  onPick: (ctx: string) => void;
}) {
  const entries = Object.entries(node.children);
  const fullPath = node.path.slice(0, -1);
  const isSelected = current === fullPath;
  const hasKids = entries.length > 0;
  const isAncestorOfSelected = hasKids && current ? current.startsWith(node.path) : false;
  const isHighlighted = isSelected || isAncestorOfSelected;

  const INDENT = 16;
  const LINE_OFFSET = 8; // vertical line x offset at each depth
  const BULLET_OFFSET = 16; // distance from depth indent to bullet
  const indent = depth * INDENT;
  const label = fullPath.split('/').filter(Boolean).slice(-1)[0];

  // Leaf row
  if (!hasKids) {
    return (
      <div className="relative h-6">
        <button
          type="button"
          className={`flex h-6 w-full min-w-0 items-center gap-2 rounded px-2 hover:bg-muted ${isSelected ? 'bg-primary/10' : ''}`}
          style={{ marginLeft: indent + BULLET_OFFSET }}
          onClick={() => onPick(isSelected ? '' : fullPath)}
        >
          <span className={`h-2 w-2 rounded-full ${isHighlighted ? 'bg-primary' : 'bg-muted'}`} />
          <span className="text-body-sm truncate leading-6">{label}</span>
        </button>
      </div>
    );
  }

  // Branch row
  return (
    <div className="relative">
      <AccordionItem value={fullPath} className="border-0">
        <div className="relative h-6">
          <AccordionTrigger hideChevron={false} className="text-body h-6 py-0 hover:no-underline">
            <div
              className="flex w-full items-center gap-2 rounded px-2 hover:bg-muted"
              style={{ marginLeft: indent + BULLET_OFFSET }}
            >
              <button
                type="button"
                className={`h-2 w-2 rounded-full ${isHighlighted ? 'bg-primary' : 'bg-muted'}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPick(isSelected ? '' : fullPath);
                }}
              />
              <span className="text-body-sm truncate leading-6">{label}</span>
            </div>
          </AccordionTrigger>
        </div>
        <AccordionContent outerClassName="py-0">
          <div className="relative">
            <span
              className="absolute bottom-0 top-0 border-l border-muted"
              style={{ left: (depth + 1) * INDENT + LINE_OFFSET }}
            />
            <ul className="mt-1 space-y-1">
              {entries
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([childName, child]) => (
                  <TreeRow
                    key={child.path}
                    node={child}
                    depth={depth + 1}
                    current={current}
                    onPick={onPick}
                  />
                ))}
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}
