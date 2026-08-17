'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  User,
  CreditCard,
  LogOut,
  Check,
  Building2,
  Building,
  AlertTriangle,
  ChevronDown,
  BarChart3,
  Settings,
  Loader2,
  ShieldCheck,
  RotateCcw,
  UserSearch,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/UI/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { getCurrentUser } from '@/lib/user/user';
import { fetchProfileSignedUrls, readProfileSignedUrls } from '@/lib/client/profileMedia';
import Image from 'next/image';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useEnvironment, useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { UserOrganization } from '@/types/user';
import ImpersonateDialog from '@/components/Layout/TopBar/ImpersonateDialog';
import AccountResetDialog from '@/components/Layout/TopBar/AccountResetDialog';
import ReferralBanner from '@/components/Layout/TopBar/ReferralBanner';
import { UnifyBlockMark } from '@/components/Brand';
import { AssistantsNavPanelShortcut } from '@/components/Layout/TopBar/AssistantsNavPanelShortcut';
import { requestPlatformHomeNavigation } from '@/lib/navigation/platformHome';

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

function WorkspaceInitialBadge({ name, size }: { name: string; size: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'h-5 w-5 text-[11px]' : 'h-4 w-4 text-[9px]';

  return (
    <span
      className={`${sizeClass} rounded-control inline-flex shrink-0 items-center justify-center bg-primary font-semibold leading-none text-primary-foreground`}
    >
      {getInitials(name)}
    </span>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { billing: billingEnabled, accountReset: accountResetEnabled } = useFeatures();
  const { isSelfHost } = useEnvironment();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileName, setProfileName] = useState('Profile');
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null);
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
  const [showPersonalWorkspaceConfirm, setShowPersonalWorkspaceConfirm] = useState(false);
  const [showSelfHostResetConfirm, setShowSelfHostResetConfirm] = useState(false);
  const [isSelfHostResetting, setIsSelfHostResetting] = useState(false);
  const [showAccountResetConfirm, setShowAccountResetConfirm] = useState(false);
  const [workspacePhotos, setWorkspacePhotos] = useState<Record<string, string>>({});
  const [showImpersonateDialog, setShowImpersonateDialog] = useState(false);

  const {
    workspaces,
    activeWorkspace,
    activeOrganization,
    switchWorkspace,
    isWorkspaceSwitchable,
    isSwitchingWorkspace,
  } = useWorkspace();
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    const img = activeOrganization?.image;
    if (!img) {
      setOrgLogoUrl(null);
      return;
    }
    if (!img.startsWith('gs://')) {
      setOrgLogoUrl(img);
      return;
    }

    // Seed from cache first so a logo already signed for the workspace
    // switcher renders immediately instead of blanking while it re-resolves.
    setOrgLogoUrl(readProfileSignedUrls([img])[img] ?? null);

    let cancelled = false;
    fetchProfileSignedUrls([img]).then((signedUrls) => {
      if (!cancelled) setOrgLogoUrl(signedUrls[img] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.image]);

  const handlePersonalWorkspaceSwitch = () => {
    // Only show confirmation if switching FROM an organization to personal
    if (activeWorkspace?.type === 'organization') {
      setShowPersonalWorkspaceConfirm(true);
    } else {
      switchWorkspace('personal');
    }
  };

  const confirmPersonalWorkspaceSwitch = () => {
    setShowPersonalWorkspaceConfirm(false);
    switchWorkspace('personal');
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.assign('/login');
  };

  const handleSelfHostReset = async () => {
    setIsSelfHostResetting(true);
    try {
      const response = await fetch('/api/self-host/reset', { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || 'Reset failed');
      }
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset failed';
      window.alert(message);
      setIsSelfHostResetting(false);
    }
  };

  // Populate user info from session provider
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          const userName = user.name || 'Profile';
          const imageUrl = user.image || '';
          setProfileName(userName);
          setUserOrgs(user.organizations || []);

          // Sign every workspace face — the personal avatar and each
          // organization logo — in one batched pass, so the switcher opens
          // with its logos already resolved rather than filling in per row.
          const workspaceImages: ReadonlyArray<readonly [string, string]> = [
            ...(user.image ? [['personal', user.image] as const] : []),
            ...(user.organizations ?? []).flatMap((org) =>
              org.image ? [[org.id.toString(), org.image] as const] : []
            ),
          ];
          const signedUrls = await fetchProfileSignedUrls(
            workspaceImages.map(([, image]) => image)
          );

          const photos: Record<string, string> = {};
          workspaceImages.forEach(([workspaceKey, image]) => {
            // Non-`gs://` images are already renderable and pass through.
            const resolvedUrl = image.startsWith('gs://') ? signedUrls[image] : image;
            if (resolvedUrl) photos[workspaceKey] = resolvedUrl;
          });
          setWorkspacePhotos(photos);

          const resolvedAvatarUrl = photos['personal'] || imageUrl;
          setAvatarJSX(
            <Avatar className="rounded-control h-6 w-6">
              <AvatarImage src={resolvedAvatarUrl} alt="User Avatar" />
              <AvatarFallback className="rounded-control text-label bg-primary text-primary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
          );
        }
      } catch (err) {
        console.error('Failed to fetch user info', err);
      }
    })();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search logic here
    console.log('Searching for:', searchQuery);
  };

  // Determine if billing should be shown
  const currentOrg =
    activeWorkspace?.type === 'organization'
      ? userOrgs.find((o) => o.id.toString() === activeWorkspace.id)
      : null;

  // Members of the "Unify" organization (internal staff) are trusted to view
  // billing/usage for any org they belong to, including during that org's free
  // trial — mirroring the page-level trial bypass in `/billing` and `/usage`.
  const isUnifyMember = userOrgs.some((o) => o.name === 'Unify');

  const canManageBilling =
    !currentOrg ||
    isUnifyMember ||
    ['owner', 'admin'].includes(currentOrg.roleName?.toLowerCase() ?? '');

  // Hide billing & usage links when the active org is in free trial mode —
  // except for Unify members, who keep access during a customer org's trial.
  const isOrgInFreeTrial = !!currentOrg?.freeTrial && !isUnifyMember;

  // Mirrors the gate in `/admin/layout.tsx`: only Owner/Admin members of
  // the "Unify" organization see the Admin link in the profile menu. Done
  // off the already-loaded `userOrgs` so there's no extra round-trip.
  const isUnifyAdmin = userOrgs.some(
    (o) => o.name === 'Unify' && ['owner', 'admin'].includes(o.roleName?.toLowerCase() ?? '')
  );
  const showSelfHostReset = isSelfHost && process.env.NODE_ENV === 'development';
  const selfHostResetControl = showSelfHostReset ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="text-body-muted h-6 gap-1.5 px-2 hover:text-foreground"
            onClick={() => setShowSelfHostResetConfirm(true)}
            disabled={isSelfHostResetting}
          >
            {isSelfHostResetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            <span>Reset</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Clear local self-host onboarding and chat history</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;
  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-10 border-b border-border bg-card">
      <div className="relative flex h-full min-w-0 items-center justify-between overflow-x-auto px-3.5">
        {/* Refer & earn promo — centered, dismissible (persisted to
            localStorage), gated on billing access so the link always lands on
            a reachable billing page. */}
        {billingEnabled && canManageBilling && !isOrgInFreeTrial && <ReferralBanner />}

        {/* Logo + Workspace + Nav */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              requestPlatformHomeNavigation();
              router.push('/assistants');
            }}
            className="flex h-full w-[42px] items-center rounded-md px-1"
            aria-label="Unify Console home"
            data-testid="platform-home-button"
          >
            <UnifyBlockMark className="scale-110" />
          </button>
          {selfHostResetControl}

          {/* Workspace Pill — hidden for personal-only users to avoid duplicating the profile avatar */}
          {activeWorkspace &&
            (activeWorkspace.type === 'organization' || isWorkspaceSwitchable) && (
              <>
                <div
                  className="mr-[13px] h-5 w-px bg-[color:var(--border)]"
                  aria-hidden="true"
                ></div>
                {isWorkspaceSwitchable ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="text-body-muted h-6 items-center gap-1.5 px-2 hover:text-foreground"
                      >
                        {isSwitchingWorkspace ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : activeWorkspace.type === 'personal' ? (
                          workspacePhotos['personal'] ? (
                            <Image
                              width={16}
                              height={16}
                              unoptimized
                              src={workspacePhotos['personal']}
                              alt=""
                              className="rounded-control h-4 w-4 shrink-0 object-cover"
                            />
                          ) : (
                            <WorkspaceInitialBadge name={activeWorkspace.name} size="md" />
                          )
                        ) : orgLogoUrl ? (
                          <Image
                            width={20}
                            height={20}
                            unoptimized
                            src={orgLogoUrl}
                            alt=""
                            className="rounded-control h-5 w-5 shrink-0 object-cover"
                          />
                        ) : (
                          <Building2 className="h-3.5 w-3.5" />
                        )}
                        <span className="max-w-[250px] truncate">
                          {isSwitchingWorkspace ? 'Switching…' : activeWorkspace.name}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[200px]" align="start">
                      <DropdownMenuLabel className="text-caption">Personal</DropdownMenuLabel>
                      {workspaces
                        .filter((w) => w.type === 'personal')
                        .map((w) => (
                          <DropdownMenuItem
                            key={w.id}
                            onSelect={() => handlePersonalWorkspaceSwitch()}
                            className="cursor-pointer items-center gap-2"
                          >
                            {workspacePhotos['personal'] ? (
                              <Image
                                width={16}
                                height={16}
                                unoptimized
                                src={workspacePhotos['personal']}
                                alt=""
                                className="rounded-control h-4 w-4 shrink-0 object-cover"
                              />
                            ) : (
                              <WorkspaceInitialBadge name={w.name} size="sm" />
                            )}
                            {w.name}
                            {activeWorkspace.id === w.id && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                        ))}

                      <DropdownMenuSeparator />

                      <DropdownMenuLabel className="text-caption">Organizations</DropdownMenuLabel>
                      {workspaces.filter((w) => w.type === 'organization').length === 0 && (
                        <div className="px-2 py-1.5 text-sm italic text-muted-foreground">
                          No organizations
                        </div>
                      )}
                      {workspaces
                        .filter((w) => w.type === 'organization')
                        .map((w) => (
                          <DropdownMenuItem
                            key={w.id}
                            onSelect={() => switchWorkspace(w.id)}
                            className="cursor-pointer items-center gap-2"
                          >
                            {workspacePhotos[w.id] ? (
                              <Image
                                width={16}
                                height={16}
                                unoptimized
                                src={workspacePhotos[w.id]}
                                alt=""
                                className="rounded-control h-4 w-4 shrink-0 object-cover"
                              />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                            {w.name}
                            {activeWorkspace.id === w.id && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/organizations"
                          className="text-body-muted flex h-6 items-center gap-1.5 px-2 transition-colors hover:text-foreground"
                          data-testid="workspace-label"
                        >
                          {activeWorkspace.type === 'personal' ? (
                            workspacePhotos['personal'] ? (
                              <Image
                                width={16}
                                height={16}
                                unoptimized
                                src={workspacePhotos['personal']}
                                alt=""
                                className="rounded-control h-4 w-4 shrink-0 object-cover"
                              />
                            ) : (
                              <WorkspaceInitialBadge name={activeWorkspace.name} size="sm" />
                            )
                          ) : orgLogoUrl ? (
                            <Image
                              width={20}
                              height={20}
                              unoptimized
                              src={orgLogoUrl}
                              alt=""
                              className="rounded-control h-5 w-5 shrink-0 object-cover"
                            />
                          ) : (
                            <Building2 className="h-3.5 w-3.5" />
                          )}
                          <span className="max-w-[250px] truncate pt-0.5">
                            {activeWorkspace.name}
                          </span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{activeWorkspace.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Upgrade Button */}
          {/*canManageBilling && (
            <Button
              variant="primary"
              className="text-body relative h-6 w-fit p-2"
              onClick={(e) => window.open('/billing', '_blank')}
            >
              Upgrade
            </Button>
          )/*}

          <AssistantsNavPanelShortcut />

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="rounded-control relative h-6 w-6 p-0"
                data-testid="profile-dropdown-trigger"
              >
                {isWorkspaceSwitchable && activeWorkspace?.type === 'personal' ? (
                  <Settings className="h-4 w-4" />
                ) : (
                  avatarJSX || <User className="h-6 w-6" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                <Link
                  href="/account"
                  className="text-body flex items-center hover:text-[color:var(--foreground)]"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Account</span>
                </Link>
              </DropdownMenuItem>
              {!isSelfHost && (
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                  <Link
                    href="/organizations"
                    className="text-body flex items-center hover:text-[color:var(--foreground)]"
                  >
                    <Building className="mr-2 h-4 w-4" />
                    <span>Organizations</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {billingEnabled && !isOrgInFreeTrial && (
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                  <Link
                    href="/usage"
                    className="text-body flex items-center hover:text-[color:var(--foreground)]"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Usage</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {billingEnabled && canManageBilling && !isOrgInFreeTrial && (
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                  <Link
                    href="/billing"
                    className="text-body flex items-center hover:text-[color:var(--foreground)]"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {isUnifyMember && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowImpersonateDialog(true);
                  }}
                  className="text-body flex cursor-pointer items-center hover:text-[color:var(--foreground)]"
                  data-testid="view-as-user-menu-item"
                >
                  <UserSearch className="mr-2 h-4 w-4" />
                  <span>View as user</span>
                </DropdownMenuItem>
              )}
              {accountResetEnabled && isUnifyMember && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowAccountResetConfirm(true);
                  }}
                  className="text-body flex cursor-pointer items-center hover:text-[color:var(--foreground)]"
                  data-testid="reset-account-menu-item"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  <span>Reset account</span>
                </DropdownMenuItem>
              )}
              {isUnifyAdmin && (
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                  <Link
                    href="/admin"
                    className="text-body flex items-center hover:text-[color:var(--foreground)]"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Admin</span>
                  </Link>
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
        </div>
      </div>

      {isUnifyMember && (
        <ImpersonateDialog open={showImpersonateDialog} onOpenChange={setShowImpersonateDialog} />
      )}

      {/* Personal Workspace Confirmation Dialog */}
      <AlertDialog
        open={showPersonalWorkspaceConfirm}
        onOpenChange={setShowPersonalWorkspaceConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)]" />
              Switch to Personal Workspace?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <p>Switching to your personal workspace means:</p>
              <ul className="text-body list-inside list-disc space-y-1">
                <li>You will only see resources in your personal account</li>
                <li>Organization resources will not be visible until you switch back</li>
                {billingEnabled && (
                  <li>Any billable usage will be billed to your personal account</li>
                )}
                <li>You won&apos;t have access to shared team resources</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPersonalWorkspaceSwitch}>
              Switch to Personal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSelfHostResetConfirm} onOpenChange={setShowSelfHostResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)]" />
              Reset Local Self-Host State?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <span className="block">
                This clears local chat, onboarding, organization, and assistant history while
                keeping the self-host owner account and T-W1N.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSelfHostResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSelfHostReset} disabled={isSelfHostResetting}>
              {isSelfHostResetting ? 'Resetting…' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccountResetDialog
        open={showAccountResetConfirm}
        onOpenChange={setShowAccountResetConfirm}
      />
    </div>
  );
}
