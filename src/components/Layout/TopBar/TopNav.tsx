"use client";

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/utils/misc/cn'
import { User, CreditCard, Key, LogOut, ExternalLink, Bot, LayoutGrid, BookOpen } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/UI/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar'
import DarkModeToggle from '@/components/Layout/NavBar/DarkModeToggle'
import ivyLogoOnly from "@/public/ivy_logo_only.png";
import { getSession } from '@/lib/user/user'
import Image from 'next/image';

// Removed favourites handling

export default function TopNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Removed unused theme hook
  // Removed favourites handling
  const [profileName, setProfileName] = useState("Profile")
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null)

  const router = useRouter()

  const handleSignOut = async () => {
    // Prevent the dropdown from closing before signOut completes
    await signOut({ redirect: false })
    router.push('/login')
  }

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
          <Avatar className="h-6 w-6">
            <AvatarImage src={imageUrl} alt="User Avatar"/>
            <AvatarFallback className="text-xs">{getInitials(userName)}</AvatarFallback>
          </Avatar>
        )
      } catch (err) {
        console.error("Failed to fetch user info", err)
      }
    })()
  }, [])

  // Removed favourites fetching effect

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search logic here
    console.log('Searching for:', searchQuery)
  }

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
                pathname === '/assistants' || pathname.startsWith('/assistants/')
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
                pathname === '/interfaces' && searchParams.get('project') !== 'Usage'
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

          {/* Upgrade Button */}
          <Button variant="primary" className="relative h-6 w-fit p-2 text-sm" onClick={(e) => window.open('/billing', '_blank')}>
            Upgrade
          </Button>

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
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="text-label">{profileName}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="hover:bg-transparent cursor-pointer">
                <Link href="/profile" className="flex items-center text-body hover:text-[color:var(--foreground)]">
                  <User className="mr-2 h-4 w-4" />
                  <span>{profileName}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-transparent cursor-pointer">
                <Link href="/billing" className="flex items-center text-body hover:text-[color:var(--foreground)]">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </Link>
              </DropdownMenuItem>
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