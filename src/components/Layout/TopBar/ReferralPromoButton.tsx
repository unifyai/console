'use client';

import * as React from 'react';
import Link from 'next/link';
import { Gift, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/UI/tooltip';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'referral-banner-dismissed';
const PROMO_LABEL = 'Refer a friend to earn $100 in credits';

function useReferralPromoVisible() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore: best-effort persistence.
    }
    setVisible(false);
  }, []);

  return { visible, dismiss };
}

function useReferralPromoAccess() {
  const { billing: billingEnabled } = useFeatures();
  const { activeOrganization, isUnifyMember } = useWorkspace();

  const canManageBilling =
    !activeOrganization ||
    isUnifyMember ||
    ['owner', 'admin'].includes(activeOrganization.roleName?.toLowerCase() ?? '');
  const isOrgInFreeTrial = !!activeOrganization?.freeTrial && !isUnifyMember;

  return billingEnabled && canManageBilling && !isOrgInFreeTrial;
}

/** Compact header affordance for the billing referral program. */
export function ReferralPromoButton({ iconButtonClassName }: { iconButtonClassName?: string }) {
  const canShow = useReferralPromoAccess();
  const { visible, dismiss } = useReferralPromoVisible();

  if (!canShow || !visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(iconButtonClassName ?? 'h-8 w-8', 'text-muted-foreground')}
          asChild
          data-testid="referral-promo-button"
        >
          <Link href="/billing" target="_blank" rel="noopener noreferrer">
            <Gift className="h-4 w-4" />
            <span className="sr-only">{PROMO_LABEL}</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{PROMO_LABEL}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Sidebar nav row for the billing referral program. */
export function ReferralPromoNavButton({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const canShow = useReferralPromoAccess();
  const { visible, dismiss } = useReferralPromoVisible();

  if (!canShow || !visible) return null;

  return (
    <div
      className={
        collapsed
          ? 'flex justify-center'
          : 'flex items-center gap-1 rounded-lg px-1 transition-colors hover:bg-muted'
      }
    >
      <Link
        href="/billing"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        data-testid="referral-promo-nav"
        title={collapsed ? PROMO_LABEL : undefined}
        className={
          collapsed
            ? 'flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted'
            : 'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:text-foreground'
        }
      >
        <Gift className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        {!collapsed && <span className="truncate">Refer &amp; earn</span>}
      </Link>
      {!collapsed && (
        <button
          type="button"
          aria-label="Dismiss referral promo"
          data-testid="referral-promo-nav-dismiss"
          onClick={dismiss}
          className="mr-1 rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export { DISMISS_KEY, PROMO_LABEL };
