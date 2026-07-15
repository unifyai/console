'use client';

import * as React from 'react';
import { PanelRight } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import { tabToolbarIconButtonClass } from '@/components/Pages/Assistants/Common/TabToolbar';
import {
  ASSISTANT_INFO_PANEL_VISIBILITY_EVENT,
  readAssistantInfoPanelVisibility,
  type AssistantInfoPanelVisibilityDetail,
} from '@/lib/assistants/infoPanelVisibility';

interface ListRowInfoToggleProps {
  entityId: string;
  isSelected: boolean;
  onToggle: () => void;
  testId: string;
}

/** Show-profile control for list rows; visible only while the row is selected. */
export function ListRowInfoToggle({
  entityId,
  isSelected,
  onToggle,
  testId,
}: ListRowInfoToggleProps) {
  const [infoPanelVisibility, setInfoPanelVisibility] =
    React.useState<AssistantInfoPanelVisibilityDetail | null>(() =>
      readAssistantInfoPanelVisibility()
    );

  React.useEffect(() => {
    const onVisibilityChange = (event: Event) => {
      setInfoPanelVisibility(
        (event as CustomEvent<AssistantInfoPanelVisibilityDetail>).detail ?? null
      );
    };
    window.addEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    };
  }, []);

  if (!isSelected) return null;

  const isInfoOpen = infoPanelVisibility?.assistantId === entityId && infoPanelVisibility.isOpen;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isInfoOpen ? 'primary' : 'ghost'}
            size="icon"
            className={cn(tabToolbarIconButtonClass)}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            aria-label={isInfoOpen ? 'Hide profile' : 'Show profile'}
            aria-pressed={isInfoOpen}
            data-testid={testId}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{isInfoOpen ? 'Hide profile' : 'Show profile'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
