"use client";

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/utils/misc/cn'
import { User, CreditCard, Key, LogOut, ExternalLink, Bot, LayoutGrid, BookOpen, Check, Building2, Building } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/UI/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from '@/components/UI/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar'
import DarkModeToggle from '@/components/Layout/NavBar/DarkModeToggle'
import ivyLogoOnly from "@/public/ivy_logo_only.png";
import { getCurrentUser } from '@/lib/user/user'
import Image from 'next/image';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { UserOrganization } from '@/types/user';

export default function TopNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [profileName, setProfileName] = useState("Profile")
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null)
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([])

  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();

  const router = useRouter()

  const handleSignOut = async () => {
    // Prevent the dropdown from closing before signOut completes
    await signOut({ redirect: false })
    router.push('/login')
  }

  // Populate user info from session provider
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
            const userName = user.name || "Profile"
            const imageUrl = user.image || ""
            setProfileName(userName)
            setUserOrgs(user.organizations || [])
            const getInitials = (name: string) => name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)
            setAvatarJSX(
            <Avatar className="h-6 w-6">
                <AvatarImage src={imageUrl} alt="User Avatar"/>
                <AvatarFallback className="text-xs">{getInitials(userName)}</AvatarFallback>
            </Avatar>
            )
        }
      } catch (err) {
        console.error("Failed to fetch user info", err)
      }
    })()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search logic here
    console.log('Searching for:', searchQuery)
  }

  // Determine if billing should be shown
  const currentOrg = activeWorkspace?.type === 'organization' 
    ? userOrgs.find(o => o.id.toString() === activeWorkspace.id)
    : null;
  
  const canManageBilling = !currentOrg || ['owner', 'admin'].includes(currentOrg.level.toLowerCase());

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-[color:var(--background)]/80 backdrop-blur-lg border-b border-[color:var(--border)] z-50">
      <div className="h-full px-3.5 flex items-center justify-between">
        {/* Logo + Nav */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src={ivyLogoOnly}
              alt="Logo (collapsed)"
              priority
              className={`h-5 w-5 object-contain transition-opacity duration-300`}
              />
          </Link>
          <div className="mx-[13px] h-5 w-px bg-[color:var(--border)]" aria-hidden="true"></div>
          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {/* Assistants - Direct Link */}
            <Link
              href="/assistants"
              className={cn(
                "px-1 first:pl-0 py-1 text-label rounded-md transition-colors flex items-center gap-1.5",
                pathname === '/assistants' || pathname?.startsWith('/assistants/')
                  ? "text-[color:var(--primary)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              )}
            >
              Assistants
            </Link>

            {/* Interfaces - Direct Link */}
            <Link
              href="/interfaces"
              className={cn(
                "px-1 first:pl-0 py-1 text-label rounded-md transition-colors flex items-center gap-1.5",
                pathname === '/interfaces' && searchParams?.get('project') !== 'Usage'
                  ? "text-[color:var(--primary)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              )}
            >
              Interfaces
            </Link>

            {/* Docs - External Link */}
            <a
              href="https://docs.unify.ai"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "px-1 first:pl-0 py-1 text-label rounded-md transition-colors flex items-center gap-1.5",
                "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              )}
            >
              Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Upgrade Button */}
          {canManageBilling && (
            <Button variant="primary" className="relative h-6 w-fit p-2 text-sm" onClick={(e) => window.open('/billing', '_blank')}>
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
              
              {activeWorkspace && (
                  <>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                            <div className="flex items-center gap-2 truncate">
                                {activeWorkspace.type === 'personal' ? (
                                    <User className="h-4 w-4" />
                                ) : (
                                    <Building2 className="h-4 w-4" />
                                )}
                                <span className="truncate max-w-[120px]">{activeWorkspace.name}&apos;s Workspace</span>
                            </div>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent className="w-[200px] p-0">
                                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                                    Personal
                                </DropdownMenuLabel>
                                {workspaces.filter(w => w.type === 'personal').map(w => (
                                    <DropdownMenuItem
                                        key={w.id}
                                        onSelect={() => switchWorkspace(w.id)}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <User className="h-4 w-4" />
                                        {w.name}
                                        {activeWorkspace.id === w.id && <Check className="ml-auto h-4 w-4" />}
                                    </DropdownMenuItem>
                                ))}

                                <DropdownMenuSeparator />
                                
                                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                                    Organizations
                                </DropdownMenuLabel>
                                {workspaces.filter(w => w.type === 'organization').length === 0 && (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground italic">No organizations</div>
                                )}
                                {workspaces.filter(w => w.type === 'organization').map(w => (
                                    <DropdownMenuItem
                                        key={w.id}
                                        onSelect={() => switchWorkspace(w.id)}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <Building2 className="h-4 w-4" />
                                        {w.name}
                                        {activeWorkspace.id === w.id && <Check className="ml-auto h-4 w-4" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
              )}

              <DropdownMenuItem asChild className="hover:bg-transparent cursor-pointer">
                <Link href="/profile" className="flex items-center text-body hover:text-[color:var(--foreground)]">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-transparent cursor-pointer">
                  <Link href="/organizations" className="flex items-center text-body hover:text-[color:var(--foreground)]">
                  <Building className="mr-2 h-4 w-4" />
                  <span>Organizations</span>
                  </Link>
              </DropdownMenuItem>
              {canManageBilling && (
                <DropdownMenuItem asChild className="hover:bg-transparent cursor-pointer">
                    <Link href="/billing" className="flex items-center text-body hover:text-[color:var(--foreground)]">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                    </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleSignOut()
                }}
                className="text-body text-[color:var(--destructive)] hover:bg-[color:var(--destructive)] hover:text-[color:var(--destructive-foreground)] cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}