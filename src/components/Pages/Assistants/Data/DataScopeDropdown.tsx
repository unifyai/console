'use client';

import * as React from 'react';
import { Check, ChevronDown, Layers, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { TeamAvatar } from '@/components/Pages/Assistants/OrgChat/TeamAvatar';
import type { BrainScopeFilterState, BrainScopeOption } from '../Common/BrainScopeFilter';

function teamIdFromOptionKey(key: string): number | null {
  if (!key.startsWith('team-')) return null;
  const id = Number(key.slice('team-'.length));
  return Number.isFinite(id) ? id : null;
}

function ScopeOptionFace({
  option,
  sizeClassName = 'h-5 w-5',
}: {
  option: BrainScopeOption;
  sizeClassName?: string;
}) {
  if (option.key === 'all') {
    return (
      <span
        className={cn(
          'rounded-control flex shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground',
          sizeClassName
        )}
        aria-hidden="true"
      >
        <Layers className="h-3 w-3" />
      </span>
    );
  }
  if (option.key === 'personal') {
    return (
      <span
        className={cn(
          'rounded-control flex shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground',
          sizeClassName
        )}
        aria-hidden="true"
      >
        <UserRound className="h-3 w-3" />
      </span>
    );
  }
  return <TeamAvatar name={option.label} className={sizeClassName} iconClassName="h-3 w-3" />;
}

function ScopeOptionCopy({
  option,
  compact = false,
}: {
  option: BrainScopeOption;
  compact?: boolean;
}) {
  const isTeam = option.key.startsWith('team-');
  return (
    <span className="min-w-0 flex-1 text-left">
      <span className={cn('block truncate', compact ? 'text-caption text-semibold' : 'text-title')}>
        {option.label}
      </span>
      {isTeam ? (
        <span className="text-caption block truncate uppercase tracking-[0.06em] text-muted-foreground">
          Team
        </span>
      ) : null}
    </span>
  );
}

interface DataScopeDropdownProps {
  scope: BrainScopeFilterState;
  className?: string;
}

/**
 * Ownership filter for the Data browser: All / Personal / each team, with
 * team faces and a "Team" sublabel so shared roots read as ownership scopes
 * rather than filesystem folders.
 */
export function DataScopeDropdown({ scope, className }: DataScopeDropdownProps) {
  if (!scope.showFilter) return null;

  const activeOption =
    scope.options.find((option) => option.key === scope.activeKey) ?? scope.options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-1.5 text-foreground transition-colors hover:bg-muted',
            className
          )}
          aria-label="Data ownership scope"
          data-testid="data-scope-dropdown"
        >
          {activeOption ? (
            <>
              <ScopeOptionFace option={activeOption} />
              <ScopeOptionCopy option={activeOption} compact />
            </>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {scope.options.map((option) => {
          const isActive = option.key === scope.activeKey;
          const teamId = teamIdFromOptionKey(option.key);
          return (
            <DropdownMenuItem
              key={option.key}
              data-testid={`data-scope-${option.key}`}
              data-team-id={teamId ?? undefined}
              onSelect={() => scope.setActiveKey(option.key)}
              className="gap-2 py-2"
            >
              <ScopeOptionFace option={option} sizeClassName="h-6 w-6" />
              <ScopeOptionCopy option={option} />
              {isActive ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
