"use client";

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/utils/misc/cn'
import { 
  Search,
  X,
  User,
  CreditCard,
  Key,
  LogOut,
  ChevronDown,
  Users,
  Activity,
  Shield,
  LayoutDashboard,
  ChartLine,
  FileText,
  Database,
  Star,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/UI/button'
import { Input } from '@/components/UI/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar'
import DarkModeToggle from '@/components/Layout/NavBar/DarkModeToggle'
import UnifyLogo from '@/components/Common/Misc/UnifyLogo'
import { useTheme } from 'next-themes'
import { Icon } from '@/components/UI/icon-picker'
import { Logo } from '@/utils/landingNav/consts'
import { getSession } from '@/lib/user/user'

interface NavItem {
  name: string
  href: string
}

interface FavouriteProject {
  id: number
  project: string
  icon: string
  position: number
}

const navItems: NavItem[] = [
  { name: 'Team', href: '/team' },
  { name: 'Interfaces', href: '/interfaces' },
  { name: 'Usage', href: '/interfaces?project=Usage' },
  { name: 'Chat', href: '/chat' },
]

export default function TopNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { theme } = useTheme()
  const [favouriteProjects, setFavouriteProjects] = useState<FavouriteProject[]>([])
  const [profileName, setProfileName] = useState("Profile")
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null)

  // Fetch user session data
  useEffect(() => {
    (async () => {
      try {
        const sessionData = await getSession()
        const userName = sessionData?.user?.name || "Profile"
        const imageUrl = sessionData?.user?.image || ""
        setProfileName(userName)
        const getInitials = (name: string) => name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)
        setAvatarJSX(
          <Avatar className="h-8 w-8">
            <AvatarImage src={imageUrl} alt="User Avatar"/>
            <AvatarFallback className="text-xs">{getInitials(userName)}</AvatarFallback>
          </Avatar>
        )
      } catch (err) {
        console.error("Failed to fetch user info", err)
      }
    })()
  }, [])

  // Fetch favourite projects
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/favourites", { method: "GET", cache: "no-store" })
        if (!res.ok) {
          console.warn("Failed to fetch favourites", res.status, res.statusText)
          return
        }
        const favourites = (await res.json()) as FavouriteProject[]
        setFavouriteProjects(favourites.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)))
      } catch (err) {
        console.error("Failed to fetch favourites for TopNav", err)
      }
    })()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search logic here
    console.log('Searching for:', searchQuery)
  }

  // Check if current path is under a dropdown section
  const isUnityActive = pathname === '/team' || pathname.startsWith('/team/')
  const isInterfacesActive = pathname === '/interfaces' && searchParams.get('project') !== 'Usage'

  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-[color:var(--background)]/80 backdrop-blur-lg border-b border-[color:var(--border)] z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Logo.dark className='hidden dark:block object-contain' width={100} height={24} loading="lazy" alt="Unify logo" />
            <Logo.light className='block dark:hidden object-contain' width={100} height={24} loading="lazy" alt="Unify logo" />
          </Link>
        </div>

        {/* Navigation - Centered */}
        <nav className="hidden md:flex items-center space-x-6 absolute left-1/2 -translate-x-1/2">
          {/* Unity Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 hover:bg-transparent",
                  isUnityActive
                    ? "text-[color:var(--primary)]"
                    : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                )}
              >
                Unity
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/team" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Members
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Interfaces Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 hover:bg-transparent hover:text-[color:var(--foreground)]",
                  isInterfacesActive
                    ? "text-[color:var(--primary)]"
                    : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                )}
              >
                Interfaces
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/interfaces" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  All Interfaces
                </Link>
              </DropdownMenuItem>
              {favouriteProjects.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase text-[color:var(--muted-foreground)]">
                    Favourites
                  </div>
                  {favouriteProjects.map((fav) => (
                    <DropdownMenuItem key={fav.id} asChild className="hover:bg-transparent">
                      <Link href={`/interfaces?project=${encodeURIComponent(fav.project)}`} className="flex items-center gap-2 hover:text-[color:var(--foreground)]">
                        <Icon name={fav.icon as any} className="h-4 w-4" />
                        <span className="truncate">{fav.project}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Usage - Direct Link to Usage Interface Project */}
          <Link
            href="/interfaces?project=Usage"
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              pathname === '/interfaces' && searchParams.get('project') === 'Usage'
                ? "text-[color:var(--primary)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            )}
          >
            Usage
          </Link>

          {/* Chat - Direct Link */}
          <Link
            href="/chat"
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              pathname === '/chat'
                ? "text-[color:var(--primary)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            )}
          >
            Chat
          </Link>

          {/* Docs - External Link */}
          <a
            href="https://docs.unify.ai"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1",
              "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            )}
          >
            Docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </nav>

        {/* Right side */}
        <div className="flex items-center space-x-2">
          {/* Search - temporarily hidden */}
          {/*
          <div className={cn(
            "flex items-center transition-all duration-200",
            isSearchExpanded ? "w-64" : "w-auto"
          )}>
            {isSearchExpanded ? (
              <form onSubmit={handleSearch} className="relative w-full">
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 h-8"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => {
                    setIsSearchExpanded(false)
                    setSearchQuery('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsSearchExpanded(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>
          */}

          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                {avatarJSX || <User className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{profileName}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="hover:bg-transparent">
                <Link href="/profile" className="flex items-center hover:text-[color:var(--foreground)]">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-transparent">
                <Link href="/billing" className="flex items-center hover:text-[color:var(--foreground)]">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-transparent">
                <Link href="/keys" className="flex items-center hover:text-[color:var(--foreground)]">
                  <Key className="mr-2 h-4 w-4" />
                  <span>API Keys</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[color:var(--destructive)] hover:bg-[color:var(--destructive)] hover:text-[color:var(--destructive-foreground)]">
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