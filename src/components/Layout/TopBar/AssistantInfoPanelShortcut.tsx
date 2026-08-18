'use client';

import { usePathname } from 'next/navigation';
import { PanelRight } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import { isAssistantInfoPanelShortcutPath } from '@/lib/navigation/appShellRoutes';
import { useAssistantInfoPanelVisibility } from '@/hooks/Assistants/useAssistantInfoPanelVisibility';
import { requestAssistantInfoPanelToggle } from '@/lib/assistants/infoPanelVisibility';

/** Toggles the assistants info side panel from the top navbar. */
export function AssistantInfoPanelShortcut({ buttonClassName }: { buttonClassName?: string }) {
  const pathname = usePathname();
  const showOnAssistantPanelRoutes = isAssistantInfoPanelShortcutPath(pathname);
  const visibility = useAssistantInfoPanelVisibility();

  if (!showOnAssistantPanelRoutes || !visibility?.assistantId) return null;

  const isOpen = visibility.isOpen;
  const showDot = visibility.showOnboardingDot ?? visibility.isCoordinatorOnboarding;
  const ariaLabel =
    showDot && !isOpen
      ? 'Show profile, setup incomplete'
      : isOpen
        ? 'Hide profile'
        : 'Show profile';

  const toggle = () => {
    requestAssistantInfoPanelToggle({ assistantId: visibility.assistantId });
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              type="button"
              variant={isOpen ? 'primary' : 'ghost'}
              className={cn(
                'rounded-control relative p-0 text-muted-foreground',
                buttonClassName ?? 'h-6 w-6',
                !isOpen && 'hover:text-foreground'
              )}
              onClick={toggle}
              data-testid="assistant-info-button"
              aria-label={ariaLabel}
              aria-pressed={isOpen}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
            {showDot && (
              <span
                data-testid="assistant-info-button-onboarding-dot"
                aria-hidden="true"
                className="pointer-events-none absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{isOpen ? 'Hide profile' : 'Show profile'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
