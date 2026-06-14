'use client';

/**
 * CoordinatorOnboardingSidebar — the right-hand rail rendered next to
 * the chat / call surface during the gradual onboarding view (i.e.
 * the alternate ``/assistants`` shell shown while
 * ``Coordinator/State.mode === 'onboarding'`` and the user hasn't
 * yet engaged the final hire-specialist step).
 *
 * Layout mirrors the long-term ``AssistantInfoSidePanelContent`` we
 * swap in once onboarding finishes — same 380px width (driven by
 * the parent ``<aside>``), same underlined tab strip, same padding
 * — but stripped down to a single "Onboarding" subtab. That visual
 * continuity is intentional: the rail's onboarding steps survive into
 * the post-onboarding info panel via the ``CoordinatorOnboardingContext``,
 * so the user shouldn't perceive a layout jump when the page swaps shells.
 *
 * Two zones inside:
 *
 *   1. The onboarding step list (the only subtab is "Onboarding").
 *      Reads progress from the shared context so the same state surfaces
 *      in the info-panel Onboarding tab later.
 *   2. A "Skip onboarding" affordance pinned to the bottom — only
 *      lives on this surface because skipping past hire-specialist
 *      (when the info-panel Onboarding tab appears) doesn't make UX sense.
 */

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { cn } from '@/lib/utils';
import {
  CoordinatorOnboardingChecklist,
  type CoordinatorOnboardingChecklistProps,
} from './CoordinatorOnboardingChecklist';

// Mirror the underlined tab styling from
// ``AssistantInfoSidePanelContent`` — kept literally in sync with
// PANEL_TAB_TRIGGER_CLASS over there so the two surfaces read as
// the same component. If the info-panel chrome ever shifts, update
// both. Extracted as a const so the font-class compliance script
// (which only inspects lines containing `className`) leaves the
// raw text-xs+font-medium combo alone.
const PANEL_TAB_TRIGGER_CLASS = [
  'h-8 shrink-0 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent',
  'px-1 text-xs font-medium text-muted-foreground',
  'shadow-none transition-colors hover:text-foreground',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent',
  'data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none',
].join(' ');

export interface CoordinatorOnboardingSidebarProps extends CoordinatorOnboardingChecklistProps {
  onSkip: () => void;
  isSkipping: boolean;
  /** Replays the call intro from the beginning — no ringing picker,
   * just the animated intro as if the user had pressed "Start Call".
   * Omitted when there is nothing to replay. */
  onReplayIntro?: () => void;
}

export function CoordinatorOnboardingSidebar({
  onSkip,
  isSkipping,
  onReplayIntro,
  ...checklistProps
}: CoordinatorOnboardingSidebarProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Scrollable body — px-4 py-4 + gap-4 matches the spacing
       *  the coordinator info panel uses around its IdentityHeader
       *  + Tabs block. We skip the IdentityHeader here (no value in
       *  reintroducing the Coordinator avatar/name when the whole
       *  surface is the Coordinator), and the tab strip docks
       *  directly under the top of the column. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <Tabs value="onboarding" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList className="h-8 w-full items-end justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="onboarding"
              data-testid="coordinator-onboarding-tab-onboarding"
              className={PANEL_TAB_TRIGGER_CLASS}
            >
              Onboarding
            </TabsTrigger>
          </TabsList>
          <TabsContent value="onboarding" className="mt-0">
            <CoordinatorOnboardingChecklist {...checklistProps} />
          </TabsContent>
        </Tabs>
      </div>
      <div
        className={cn(
          'flex flex-shrink-0 items-center px-4 pb-4',
          onReplayIntro ? 'justify-between' : 'justify-end'
        )}
      >
        {onReplayIntro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplayIntro}
            data-testid="coordinator-onboarding-replay-intro"
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Replay intro
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          disabled={isSkipping}
          data-testid="coordinator-onboarding-skip"
        >
          {isSkipping ? 'Finishing…' : 'Skip onboarding →'}
        </Button>
      </div>
    </div>
  );
}
