'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import SupportTicketDialog from '@/components/Layout/TopBar/SupportTicketDialog';
import { ReferralPromoButton } from '@/components/Layout/TopBar/ReferralPromoButton';
import { AssistantsNavPanelShortcut } from '@/components/Layout/TopBar/AssistantsNavPanelShortcut';
import { tabToolbarIconButtonClass } from '@/components/Pages/Assistants/Common/TabToolbar';

/** Workspace-level quick actions shared across section and internal route headers. */
export function GlobalPlatformActions() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme === 'dark';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-0.5">
        <AssistantsNavPanelShortcut />
        <ReferralPromoButton iconButtonClassName={tabToolbarIconButtonClass} />
        <SupportTicketDialog triggerClassName={tabToolbarIconButtonClass} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(tabToolbarIconButtonClass, 'text-muted-foreground')}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isDark ? 'Switch to light' : 'Switch to dark'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
