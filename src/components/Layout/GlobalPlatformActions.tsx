'use client';

import * as React from 'react';
import { Search, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import SupportTicketDialog from '@/components/Layout/TopBar/SupportTicketDialog';
import { useTabSearchFocus } from '@/components/Pages/Assistants/Common/TabSearchContext';

/** Workspace-level quick actions shared across section and internal route headers. */
export function GlobalPlatformActions() {
  const { theme, setTheme } = useTheme();
  const focusTabSearch = useTabSearchFocus();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme === 'dark';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-0.5">
        <SupportTicketDialog />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Search this workspace"
              onClick={() => focusTabSearch()}
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Focus tab search</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mounted && isDark ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
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
