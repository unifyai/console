'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifyBlockMark, CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import type { Assistant } from '@/types/assistants/assistant';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import { RailNavButton } from './RailNavButton';
import { RailFoot } from './RailFoot';
import { WORKSPACE_SECTIONS, BRAIN_SECTIONS, type SectionDef } from './sectionConfig';

const RAIL_COLLAPSED_STORAGE_KEY = 'console:assistants:railCollapsed';

function DroidAvatar({ assistant, sizeClass }: { assistant: Assistant; sizeClass: string }) {
  if (assistant.isCoordinator) {
    return <CoordinatorLogoAvatar className={cn('shrink-0', sizeClass)} />;
  }
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const creature = parseCreatureSentinel(photoSrc);
  if (creature) {
    return (
      <CreatureAvatar
        appearance={creature}
        className={cn('rounded-control shrink-0', sizeClass)}
        label={assistantDisplayName(assistant)}
      />
    );
  }
  return (
    <Avatar className={cn('rounded-control shrink-0', sizeClass)}>
      <AvatarImage src={photoSrc ?? undefined} alt={assistantDisplayName(assistant)} />
      <AvatarFallback className="rounded-control">{assistantInitials(assistant)}</AvatarFallback>
    </Avatar>
  );
}

interface AssistantRailProps {
  /** Currently-open droid; drives the switcher card face. */
  activeDroid: Assistant | null;
  /** Full prop bag forwarded to the embedded `AssistantList` (the switcher). */
  listProps: React.ComponentProps<typeof AssistantList>;
  /** The active rail section id (a `SectionDef.id`). */
  activeSection: string;
  onSelectSection: (section: SectionDef) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function AssistantRail({
  activeDroid,
  listProps,
  activeSection,
  onSelectSection,
  collapsed,
  onCollapsedChange,
}: AssistantRailProps) {
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  const droidName = activeDroid ? assistantDisplayName(activeDroid) : 'Select a droid';
  const droidSub = activeDroid
    ? activeDroid.isCoordinator
      ? 'Coordinator'
      : activeDroid.jobTitle?.trim() || 'Droid'
    : 'No droid selected';

  // Selecting a droid in the popover should switch to it and dismiss the popover.
  const handleShowProfile = React.useCallback(
    (id: string) => {
      listProps.onShowProfile(id);
      setSwitcherOpen(false);
    },
    [listProps]
  );

  const renderSection = (s: SectionDef) => (
    <RailNavButton
      key={s.id}
      Icon={s.Icon}
      label={s.label}
      collapsed={collapsed}
      active={activeSection === s.id}
      onClick={() => onSelectSection(s)}
      testId={`rail-section-${s.id}`}
    />
  );

  return (
    <aside
      data-testid="assistant-rail"
      className={cn(
        'flex h-full flex-col border-r border-border bg-background transition-[width] duration-150',
        collapsed ? 'w-[74px]' : 'w-[258px]'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-2 pb-3.5 pt-[18px]',
          collapsed ? 'justify-center px-0' : 'px-[18px]'
        )}
      >
        <UnifyBlockMark />
        {!collapsed && (
          <span className="font-display text-[18px] font-semibold tracking-tight">Droid</span>
        )}
      </div>

      {/* Droid switcher */}
      <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="rail-droid-switcher"
            title={collapsed ? droidName : undefined}
            className={cn(
              'flex items-center gap-3 transition-colors',
              collapsed
                ? 'mx-auto mb-2 rounded-xl p-1.5 hover:bg-muted'
                : 'mx-3.5 mb-2 rounded-xl border border-border bg-muted px-3 py-2 hover:bg-accent'
            )}
          >
            {activeDroid ? (
              <DroidAvatar
                assistant={activeDroid}
                sizeClass={collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]'}
              />
            ) : (
              <span className="rounded-control grid h-9 w-9 shrink-0 place-items-center bg-card text-muted-foreground">
                ?
              </span>
            )}
            {!collapsed && (
              <>
                <div className="min-w-0 text-left">
                  <div className="truncate font-display text-[14.5px] font-semibold">
                    {droidName}
                  </div>
                  <div className="truncate text-[11.5px] capitalize text-muted-foreground">
                    {droidSub}
                  </div>
                </div>
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          data-testid="rail-droid-switcher-popover"
          className="flex h-[70vh] max-h-[560px] w-[320px] flex-col overflow-hidden p-0"
        >
          <AssistantList
            {...listProps}
            onShowProfile={handleShowProfile}
            isFolded={false}
            onToggleFold={undefined}
          />
        </PopoverContent>
      </Popover>

      {/* Section nav */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5">
        {!collapsed && (
          <div className="px-3 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Workspace
          </div>
        )}
        {WORKSPACE_SECTIONS.map(renderSection)}
        {collapsed ? (
          <div className="mx-1.5 my-2 h-px bg-border" />
        ) : (
          <div className="px-3 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Brain
          </div>
        )}
        {BRAIN_SECTIONS.map(renderSection)}
      </div>

      <RailFoot collapsed={collapsed} onToggleCollapse={() => onCollapsedChange(!collapsed)} />
    </aside>
  );
}

export { RAIL_COLLAPSED_STORAGE_KEY };
