'use client';

import * as React from 'react';
import {
  ChevronsUpDown,
  Check,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  UserSearch,
  RotateCcw,
  Moon,
  Sun,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  RAIL_GUTTER,
  RAIL_ROW_PAD,
  RAIL_ROW_SHELL,
  RAIL_SWITCHER_GLYPH,
  RAIL_SWITCHER_SLOT,
  RAIL_TRAILING_INSET,
  RailTrailingButton,
} from '@/components/Layout/Shell/railGeometry';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import {
  profileAvatarTone,
  profileInitials,
  userFullName,
  userInitials,
} from '@/utils/user/profileDisplay';
import { getAnySessionContactIdForUser } from '@/hooks/Assistants/useContactIdPrefetch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { ReferralPromoNavButton } from '@/components/Layout/TopBar/ReferralPromoButton';
import SupportTicketDialog from '@/components/Layout/TopBar/SupportTicketDialog';
import ImpersonateDialog from '@/components/Layout/TopBar/ImpersonateDialog';
import AccountResetDialog from '@/components/Layout/TopBar/AccountResetDialog';
import { useAppShellNavigation, pathnameFromHref } from '@/lib/navigation/AppShellRouter';
import { isSettingsFamilyPath } from '@/lib/navigation/shellRoutes';
import { RailNavButton } from './RailNavButton';

async function resolveStorageUrl(gsUrl: string): Promise<string> {
  if (!gsUrl.startsWith('gs://')) return gsUrl;
  const response = await fetch('/api/storage/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    body: JSON.stringify({ gs_url: gsUrl }),
  });
  if (!response.ok) return '';
  const data = await response.json();
  return data.signed_url ?? '';
}

function WorkspaceAvatarBadge({
  name,
  image,
  contactId,
  className,
}: {
  name: string;
  image?: string | null;
  contactId?: number | null;
  className?: string;
}) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const avatarTone = profileAvatarTone(name, contactId);

  React.useEffect(() => {
    let cancelled = false;
    if (!image) {
      setImageUrl(null);
      return;
    }
    (async () => {
      const url = await resolveStorageUrl(image).catch(() => '');
      if (!cancelled) setImageUrl(url || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [image]);

  return (
    <Avatar className={cn('h-4 w-4 shrink-0 rounded-md', className)}>
      <AvatarImage src={imageUrl ?? undefined} alt={name} className="object-cover" />
      <AvatarFallback
        className="rounded-md font-display text-[9px] font-semibold text-primary-foreground"
        style={{ backgroundColor: avatarTone }}
      >
        {profileInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

interface RailFootProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * The rail's foot: the workspace row, the theme and support entries, and the
 * collapse-to-dock control.
 *
 * The workspace row is the teammate switcher's twin at the other end of the
 * rail, and reads the same way: the face is the settings entry — this
 * workspace's own settings — while the chevron beside it (expanded) or beneath
 * it (folded) is the only way to a different workspace. Settings therefore has
 * no separate nav row; the identity it belongs to is the way in.
 */
export function RailFoot({ collapsed, onToggleCollapse }: RailFootProps) {
  const { navigateTo, activeHref } = useAppShellNavigation();
  const activePath = pathnameFromHref(activeHref);
  const {
    user,
    workspaces,
    activeWorkspace,
    activeOrganization,
    switchWorkspace,
    isWorkspaceSwitchable,
    isSwitchingWorkspace,
    isUnifyMember,
  } = useWorkspace();
  const { accountReset: accountResetEnabled } = useFeatures();
  const { theme, setTheme } = useTheme();

  const [showImpersonateDialog, setShowImpersonateDialog] = React.useState(false);
  const [showAccountResetConfirm, setShowAccountResetConfirm] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [ownerContactId, setOwnerContactId] = React.useState<number | null>(null);

  const personalDisplayName = user ? userFullName(user) || 'Personal' : 'Personal';
  const displayName =
    activeWorkspace?.type === 'organization'
      ? (activeWorkspace.name ?? 'Organization')
      : personalDisplayName;
  const subtitle = activeWorkspace?.type === 'organization' ? 'Organization' : 'Personal';
  const initials =
    activeWorkspace?.type === 'organization'
      ? profileInitials(displayName)
      : user
        ? userInitials(user)
        : profileInitials(displayName);
  const avatarTone = profileAvatarTone(
    displayName,
    activeWorkspace?.type === 'personal' ? ownerContactId : null
  );

  React.useEffect(() => {
    if (!user?.email || activeWorkspace?.type !== 'personal') {
      setOwnerContactId(null);
      return;
    }
    const syncContactId = () => {
      const cached = getAnySessionContactIdForUser(user.email);
      setOwnerContactId(cached ?? null);
    };
    syncContactId();
    const onContactIdUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ email?: string }>).detail;
      if (!detail?.email || detail.email === user.email) syncContactId();
    };
    window.addEventListener('owner-contact-id-updated', onContactIdUpdated);
    return () => window.removeEventListener('owner-contact-id-updated', onContactIdUpdated);
  }, [user?.email, activeWorkspace?.type]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const image =
        activeWorkspace?.type === 'organization' ? activeOrganization?.image : user?.image;
      if (!image) {
        if (!cancelled) setAvatarUrl(null);
        return;
      }
      const url = await resolveStorageUrl(image).catch(() => '');
      if (!cancelled) setAvatarUrl(url || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.type, activeOrganization?.image, user?.image]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.assign('/login');
  };

  const personalWorkspaces = workspaces.filter((w) => w.type === 'personal');
  const orgWorkspaces = workspaces.filter((w) => w.type === 'organization');
  const isDark = theme === 'dark';
  const settingsActive = isSettingsFamilyPath(activePath);

  const workspaceFace = (
    <button
      type="button"
      data-testid="rail-nav-settings"
      title={collapsed ? `Settings (${displayName})` : undefined}
      aria-label={`Settings — ${displayName}`}
      aria-current={settingsActive ? 'page' : undefined}
      onClick={() => navigateTo('/account')}
      className={cn(
        collapsed
          ? 'flex items-center rounded-lg p-1.5 transition-colors'
          : // `pr-11` clears the picker, which sits in the row's trailing slot
            // rather than in a strip of its own.
            cn(RAIL_ROW_SHELL, RAIL_ROW_PAD, 'py-1.5 pr-11 text-left'),
        settingsActive
          ? 'bg-accent-soft text-accent-soft-foreground'
          : 'text-foreground hover:bg-muted'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback
          className="text-caption-sm font-display font-semibold text-primary-foreground"
          style={{ backgroundColor: avatarTone }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <div className="min-w-0 text-left">
          <div className="text-h3 truncate">{displayName}</div>
          <div className="text-caption-sm truncate">{subtitle}</div>
        </div>
      )}
    </button>
  );

  const workspacePicker = (
    <DropdownMenuTrigger asChild>
      <RailTrailingButton
        data-testid="rail-account-trigger"
        title={collapsed ? `Switch workspace (${displayName})` : undefined}
        aria-label={`Switch workspace — ${displayName}`}
        className={cn(
          RAIL_SWITCHER_SLOT,
          !collapsed && cn('absolute top-1/2 -translate-y-1/2', RAIL_TRAILING_INSET)
        )}
      >
        {isSwitchingWorkspace ? (
          <Loader2 className={cn(RAIL_SWITCHER_GLYPH, 'animate-spin')} aria-hidden="true" />
        ) : (
          <ChevronsUpDown className={RAIL_SWITCHER_GLYPH} strokeWidth={1.75} aria-hidden="true" />
        )}
      </RailTrailingButton>
    </DropdownMenuTrigger>
  );

  return (
    <div
      className={cn(
        'mt-auto flex flex-col gap-0.5 border-t border-border pt-2',
        collapsed ? 'px-3 pb-2.5' : cn(RAIL_GUTTER, 'pb-2.5')
      )}
    >
      <DropdownMenu>
        {/* Siblings rather than one inside the other: only the chevron opens
            the menu. Folded, it drops beneath the face, as the teammate
            switcher's picker does at the other end of the rail. */}
        <div
          className={collapsed ? 'mx-auto flex w-fit flex-col items-center gap-0.5' : 'relative'}
        >
          {workspaceFace}
          {workspacePicker}
        </div>
        {/* The chevron is the trigger, so the menu hangs from the row's
            trailing edge rather than starting under it. */}
        <DropdownMenuContent
          side="top"
          align="end"
          className="w-[250px]"
          data-testid="rail-account-menu"
        >
          {isWorkspaceSwitchable && (
            <>
              <DropdownMenuLabel>Personal</DropdownMenuLabel>
              {personalWorkspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => switchWorkspace(w.id)}
                  className="cursor-pointer items-center gap-2"
                >
                  <WorkspaceAvatarBadge
                    name={w.name}
                    image={w.image}
                    contactId={w.type === 'personal' ? ownerContactId : null}
                  />
                  <span className="truncate">{w.name}</span>
                  {activeWorkspace?.id === w.id && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
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
                  <WorkspaceAvatarBadge
                    name={w.name}
                    image={w.image}
                    contactId={w.type === 'personal' ? ownerContactId : null}
                  />
                  <span className="truncate">{w.name}</span>
                  {activeWorkspace?.id === w.id && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {isUnifyMember && (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setShowImpersonateDialog(true);
                }}
                className="cursor-pointer items-center"
                data-testid="view-as-user-menu-item"
              >
                <UserSearch className="mr-2 h-4 w-4" />
                <span>View as user</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {accountResetEnabled && isUnifyMember && (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setShowAccountResetConfirm(true);
                }}
                className="cursor-pointer items-center"
                data-testid="reset-account-menu-item"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                <span>Reset account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
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

      <RailNavButton
        Icon={isDark ? Sun : Moon}
        label={isDark ? 'Switch to light' : 'Switch to dark'}
        collapsed={collapsed}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        testId="rail-theme-toggle"
      />
      <SupportTicketDialog collapsed={collapsed} />
      <ReferralPromoNavButton collapsed={collapsed} />

      {isUnifyMember && (
        <ImpersonateDialog open={showImpersonateDialog} onOpenChange={setShowImpersonateDialog} />
      )}

      <AccountResetDialog
        open={showAccountResetConfirm}
        onOpenChange={setShowAccountResetConfirm}
      />

      <RailNavButton
        Icon={collapsed ? PanelLeftOpen : PanelLeftClose}
        label={collapsed ? 'Expand sidebar' : 'Collapse'}
        collapsed={collapsed}
        onClick={onToggleCollapse}
        testId="rail-collapse-toggle"
      />
    </div>
  );
}
