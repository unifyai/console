'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Settings,
  ShieldCheck,
  ChevronsUpDown,
  Check,
  Building2,
  CreditCard,
  BarChart3,
  Building,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useEnvironment, useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { getCurrentUser } from '@/lib/user/user';
import { RailNavButton } from './RailNavButton';

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

interface RailFootProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * The rail's foot: quick Settings/Admin nav, an account row that opens the
 * workspace switcher plus account/usage/billing/organizations links and sign
 * out (relocated from the legacy `TopNav`), and the collapse-to-dock control.
 */
export function RailFoot({ collapsed, onToggleCollapse }: RailFootProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { billing: billingEnabled } = useFeatures();
  const { isSelfHost } = useEnvironment();
  const {
    workspaces,
    activeWorkspace,
    activeOrganization,
    switchWorkspace,
    isWorkspaceSwitchable,
    isSwitchingWorkspace,
    isUnifyAdmin,
    isUnifyMember,
  } = useWorkspace();

  const [profileName, setProfileName] = React.useState('Account');

  React.useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setProfileName(user.name || 'Account');
        }
      } catch (err) {
        console.error('Failed to fetch user info', err);
      }
    })();
  }, []);

  const canManageBilling =
    !activeOrganization ||
    isUnifyMember ||
    ['owner', 'admin'].includes(activeOrganization.roleName?.toLowerCase() ?? '');
  const isOrgInFreeTrial = !!activeOrganization?.freeTrial && !isUnifyMember;

  const accountSub =
    activeWorkspace?.type === 'organization' ? 'Organization' : activeWorkspace?.name || 'Personal';
  const accountName = activeWorkspace?.name || profileName;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.assign('/login');
  };

  const personalWorkspaces = workspaces.filter((w) => w.type === 'personal');
  const orgWorkspaces = workspaces.filter((w) => w.type === 'organization');

  return (
    <div
      className={cn(
        'mt-auto flex flex-col gap-0.5 border-t border-border pt-2',
        collapsed ? 'px-3 pb-2.5' : 'px-2.5 pb-2.5'
      )}
    >
      {isUnifyAdmin && (
        <RailNavButton
          Icon={ShieldCheck}
          label="Admin"
          collapsed={collapsed}
          active={pathname?.startsWith('/admin')}
          onClick={() => router.push('/admin')}
          testId="rail-nav-admin"
        />
      )}
      <RailNavButton
        Icon={Settings}
        label="Settings"
        collapsed={collapsed}
        active={pathname?.startsWith('/account')}
        onClick={() => router.push('/account')}
        testId="rail-nav-settings"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="rail-account-trigger"
            title={collapsed ? accountName : undefined}
            className={cn(
              'flex items-center gap-3 rounded-[10px] transition-colors hover:bg-muted',
              collapsed ? 'justify-center px-0 py-1.5' : 'px-2.5 py-1.5'
            )}
          >
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-foreground font-display text-[13px] font-semibold text-background">
              {getInitials(accountName)}
            </span>
            {!collapsed && (
              <div className="min-w-0 text-left">
                <div className="truncate text-[13px] font-semibold text-foreground">
                  {accountName}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">{accountSub}</div>
              </div>
            )}
            {!collapsed &&
              (isSwitchingWorkspace ? (
                <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ))}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-[250px]"
          data-testid="rail-account-menu"
        >
          {isWorkspaceSwitchable && (
            <>
              <DropdownMenuLabel className="text-caption">Personal</DropdownMenuLabel>
              {personalWorkspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => switchWorkspace(w.id)}
                  className="cursor-pointer items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{w.name}</span>
                  {activeWorkspace?.id === w.id && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuLabel className="text-caption">Organizations</DropdownMenuLabel>
              {orgWorkspaces.length === 0 && (
                <div className="px-2 py-1.5 text-sm italic text-muted-foreground">
                  No organizations
                </div>
              )}
              {orgWorkspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => switchWorkspace(w.id)}
                  className="cursor-pointer items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{w.name}</span>
                  {activeWorkspace?.id === w.id && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {billingEnabled && !isOrgInFreeTrial && (
            <DropdownMenuItem onSelect={() => router.push('/usage')} className="cursor-pointer">
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Usage</span>
            </DropdownMenuItem>
          )}
          {billingEnabled && canManageBilling && !isOrgInFreeTrial && (
            <DropdownMenuItem onSelect={() => router.push('/billing')} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Billing</span>
            </DropdownMenuItem>
          )}
          {!isSelfHost && (
            <DropdownMenuItem
              onSelect={() => router.push('/organizations')}
              className="cursor-pointer"
            >
              <Building className="mr-2 h-4 w-4" />
              <span>Organizations</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
            className="cursor-pointer text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapse}
              data-testid="rail-collapse-toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex items-center gap-3 rounded-[10px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2'
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} />
              )}
              {!collapsed && <span>Collapse</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">
              <p>Expand sidebar</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
