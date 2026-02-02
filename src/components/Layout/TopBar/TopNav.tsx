'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/utils/misc/cn';
import {
  User,
  CreditCard,
  LogOut,
  Check,
  Building2,
  Building,
  AlertTriangle,
  ChevronDown,
  Slash,
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
import DarkModeToggle from '@/components/Layout/NavBar/DarkModeToggle';
import ivyLogoOnly from '@/public/ivy_logo_only.png';
import { getCurrentUser } from '@/lib/user/user';
import Image from 'next/image';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { UserOrganization } from '@/types/user';

export default function TopNav() {
  const pathname = usePathname();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileName, setProfileName] = useState('Profile');
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null);
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
  const [showPersonalWorkspaceConfirm, setShowPersonalWorkspaceConfirm] = useState(false);

  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();

  const router = useRouter();

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
    // Prevent the dropdown from closing before signOut completes
    await signOut({ redirect: false });
    router.push('/login');
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
          const getInitials = (name: string) =>
            name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
          setAvatarJSX(
            <Avatar className="h-6 w-6">
              <AvatarImage src={imageUrl} alt="User Avatar" />
              <AvatarFallback className="text-label">{getInitials(userName)}</AvatarFallback>
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

  const canManageBilling =
    !currentOrg || ['owner', 'admin'].includes(currentOrg.roleName?.toLowerCase() ?? '');

  return (
    <div className="bg-[color:var(--background)]/80 fixed left-0 right-0 top-0 z-50 h-10 border-b border-[color:var(--border)] backdrop-blur-lg">
      <div className="flex h-full items-center justify-between px-3.5">
        {/* Logo + Workspace + Nav */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center px-1">
            <Image
              src={ivyLogoOnly}
              alt="Logo (collapsed)"
              priority
              className={`h-5 w-5 object-contain transition-opacity duration-300`}
            />
          </Link>

          {/* Workspace Pill */}
          {activeWorkspace && (
            <>
              <div className="mx-[13px] h-5 w-px bg-[color:var(--border)]" aria-hidden="true"></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-body-muted h-6 gap-1.5 px-2 hover:text-foreground"
                  >
                    {activeWorkspace.type === 'personal' ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5" />
                    )}
                    <span className="max-w-[120px] truncate">{activeWorkspace.name}</span>
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
                        className="cursor-pointer gap-2"
                      >
                        <User className="h-4 w-4" />
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
                        className="cursor-pointer gap-2"
                      >
                        <Building2 className="h-4 w-4" />
                        {w.name}
                        {activeWorkspace.id === w.id && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="mx-[13px] h-5 w-px bg-[color:var(--border)]" aria-hidden="true"></div>

          {/* Navigation */}
          <nav className="hidden items-center space-x-6 md:flex">
            {/* Assistants - Direct Link */}
            <Link
              href="/assistants"
              className={cn(
                'text-label flex items-center gap-1.5 rounded-md px-1 py-1 transition-colors first:pl-0',
                pathname === '/assistants' || pathname?.startsWith('/assistants/')
                  ? 'text-[color:var(--primary)]'
                  : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
              )}
            >
              Assistants
            </Link>
            {/* Usage - Direct Link */}
            <Link
              href="/usage"
              className={cn(
                'text-label flex items-center gap-1.5 rounded-md px-1 py-1 transition-colors',
                pathname === '/usage'
                  ? 'text-[color:var(--primary)]'
                  : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
              )}
            >
              Usage
            </Link>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Upgrade Button */}
          {canManageBilling && (
            <Button
              variant="primary"
              className="text-body relative h-6 w-fit p-2"
              onClick={(e) => window.open('/billing', '_blank')}
            >
              Upgrade
            </Button>
          )}

          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-6 w-6 rounded-full p-0">
                {avatarJSX || <User className="h-6 w-6" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                <Link
                  href="/profile"
                  className="text-body flex items-center hover:text-[color:var(--foreground)]"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-transparent">
                <Link
                  href="/organizations"
                  className="text-body flex items-center hover:text-[color:var(--foreground)]"
                >
                  <Building className="mr-2 h-4 w-4" />
                  <span>Organizations</span>
                </Link>
              </DropdownMenuItem>
              {canManageBilling && (
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleSignOut();
                }}
                className="text-body cursor-pointer text-[color:var(--destructive)] hover:bg-[color:var(--destructive)] hover:text-[color:var(--destructive-foreground)]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Personal Workspace Confirmation Dialog */}
      <AlertDialog
        open={showPersonalWorkspaceConfirm}
        onOpenChange={setShowPersonalWorkspaceConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Switch to Personal Workspace?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <p>Switching to your personal workspace means:</p>
              <ul className="text-body list-inside list-disc space-y-1">
                <li>You will only see resources in your personal account</li>
                <li>Organization resources will not be visible until you switch back</li>
                <li>Any billable usage will be billed to your personal account</li>
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
    </div>
  );
}
