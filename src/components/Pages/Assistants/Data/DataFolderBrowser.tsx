'use client';

import * as React from 'react';
import { ChevronRight, Folder, FolderPlus, Table2, Upload } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import type { DataCwd, DataFolderChild } from '@/lib/assistants/dataBrowser';
import { TeamAvatar } from '../OrgChat/TeamAvatar';
import { UserRound } from 'lucide-react';

export type DataFolderSection = {
  key: string;
  kind: 'personal' | 'team';
  label: string;
  imageUrl?: string | null;
  isOrgWideSharing?: boolean;
};

export type DataFolderBrowserProps = {
  /** Null when multi-scope and user has not entered a section yet. */
  cwd: DataCwd | null;
  sections: DataFolderSection[];
  showSectionPicker: boolean;
  entries: DataFolderChild[];
  selectedContext: string | null;
  locationLabel: string;
  onEnterSection: (sectionKey: string) => void;
  onBackToScopes?: () => void;
  onNavigate: (segments: string[]) => void;
  onOpenTable: (context: string) => void;
  onNewTable: () => void;
  onUpload: () => void;
};

export function DataFolderBrowser({
  cwd,
  sections,
  showSectionPicker,
  entries,
  selectedContext,
  locationLabel,
  onEnterSection,
  onBackToScopes,
  onNavigate,
  onOpenTable,
  onNewTable,
  onUpload,
}: DataFolderBrowserProps) {
  if (showSectionPicker && !cwd) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="data-folder-browser"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => onEnterSection(section.key)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              data-testid={`data-scope-enter-${section.key}`}
            >
              {section.kind === 'team' ? (
                <TeamAvatar
                  name={section.label}
                  imageUrl={section.imageUrl}
                  isOrgWideSharing={section.isOrgWideSharing}
                  className="h-5 w-5"
                  iconClassName="h-3 w-3"
                />
              ) : (
                <span className="rounded-control flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                  <UserRound className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
              <span className="truncate">{section.label}</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const section = sections.find((s) => s.key === cwd?.sectionKey);
  const crumbs: { label: string; segments: string[] | null }[] = [];
  if (showSectionPicker && section) {
    crumbs.push({ label: section.label, segments: [] });
  } else {
    crumbs.push({ label: 'Data', segments: [] });
  }
  if (cwd) {
    // When section picker is on, segment breadcrumbs are under Data within the section.
    // Root crumb already navigates to Data root (empty segments).
    cwd.segments.forEach((seg, i) => {
      crumbs.push({ label: seg, segments: cwd.segments.slice(0, i + 1) });
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="data-folder-browser">
      <div
        className="flex shrink-0 flex-col gap-2 border-b border-border px-2 py-2"
        data-testid="data-folder-chrome"
      >
        <nav
          className="text-caption flex min-w-0 flex-wrap items-center gap-0.5"
          aria-label="Data folder path"
          data-testid="data-folder-breadcrumbs"
        >
          {showSectionPicker && onBackToScopes ? (
            <button
              type="button"
              className="rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
              onClick={onBackToScopes}
              data-testid="data-folder-crumb-scopes"
            >
              All
            </button>
          ) : null}
          {crumbs.map((crumb, i) => (
            <React.Fragment key={`${crumb.label}-${i}`}>
              {(i > 0 || (showSectionPicker && onBackToScopes)) && (
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              {i === crumbs.length - 1 ? (
                <span className="truncate px-1 py-0.5 font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="truncate rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
                  onClick={() => crumb.segments && onNavigate(crumb.segments)}
                  data-testid={`data-folder-crumb-${i}`}
                >
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>

        <p
          className="text-caption truncate text-muted-foreground"
          data-testid="data-folder-location"
        >
          {locationLabel}
        </p>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1.5"
            onClick={onNewTable}
            data-testid="data-new-table"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
            New table
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1.5"
            onClick={onUpload}
            data-testid="data-upload"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
        {entries.length === 0 ? (
          <div className="px-2 py-6 text-center" data-testid="data-folder-empty">
            <p className="text-caption text-muted-foreground">No tables in this folder yet.</p>
            <p className="text-caption mt-1 text-muted-foreground">
              Create a table or upload a file to get started.
            </p>
          </div>
        ) : (
          entries.map((child) => {
            const isSelected = child.kind === 'table' && child.context === selectedContext;
            return (
              <button
                key={`${child.kind}:${child.name}`}
                type="button"
                onClick={() => {
                  if (child.kind === 'folder') {
                    onNavigate([...(cwd?.segments ?? []), child.name]);
                  } else if (child.context) {
                    onOpenTable(child.context);
                  }
                }}
                data-testid={child.kind === 'folder' ? 'data-folder-node' : 'data-table-node'}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-primary-tint-10 text-primary'
                    : 'text-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {child.kind === 'folder' ? (
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="truncate">{child.name}</span>
                {child.kind === 'folder' ? (
                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
