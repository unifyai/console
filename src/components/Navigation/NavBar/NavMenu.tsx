"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/UI/sidebar";
import NavList from "./NavList";
import UnifyLogo from "@/components/Common/Misc/UnifyLogo";
import DarkModeToggle from "./DarkModeToggle";
import SignOutButton from "./SignOut";
import { NavItem } from "@/types/navigation";
import Link from "next/link";
import { getSession } from "@/lib/user/user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/UI/avatar";
import { useTheme } from "next-themes";
import ivyLogoOnly from "@/public/ivy_logo_only.png";
import Image from "next/image";
import { User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

/** A single nav item with an icon and label. */
function renderMenuItem(item: NavItem, isActive: boolean) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem key={item.title} className="px-2 py-1 transition-colors">
      <SidebarMenuButton asChild isActive={isActive}>
        <Link
          href={item.href}
          className={`flex items-center transition-colors ${
            isActive
              ? "font-bold text-sidebar-accent-foreground"
              : "hover:text-sidebar-primary hover:bg-transparent"
          }`}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? "text-sidebar-accent-foreground" : ""
                    }`}
                  />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.title}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-2 group-data-[collapsible=icon]:hidden">
            {item.title}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function NavMenu() {
  const currentPath = usePathname() || "";
  const { state } = useSidebar(); // "expanded" or "collapsed"
  const { resolvedTheme } = useTheme();
  const [profileName, setProfileName] = useState("Profile");
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sessionData = await getSession();
        const userName = sessionData?.user?.name || "Profile";
        const imageUrl = sessionData?.user?.image || "";

        setProfileName(userName);

        // Generate 1-2 letter fallback text:
        const getInitials = (name: string) => 
          name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

        setAvatarJSX(
          <Avatar className="h-5 w-5">
            <AvatarImage src={imageUrl} alt="User Avatar"/>
            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
          </Avatar>
        );
      } catch (err) {
        console.error("Failed to fetch user info", err);
      }
    })();
  }, []);

  const mainNavItems = NavList();

  // The user profile nav item
  const profileItem: NavItem = {
    title: profileName,
    icon: avatarJSX ? () => avatarJSX : User,
    href: "/profile",
  };

  // Highlight the active item
  const isActive = (item: NavItem) => 
    currentPath === item.href || currentPath.startsWith(`${item.href}/`);

  return (
    <Sidebar collapsible="icon">
      {/* SidebarHeader with crossfade logos */}
      <SidebarHeader className="relative h-12 w-full flex items-center justify-center overflow-hidden">
        {/* Collapsed logo (ivyLogoOnly) */}
        <Image
          src={ivyLogoOnly}
          alt="Logo (collapsed)"
          priority
          className={`
            absolute h-5 w-5 object-contain 
            transition-opacity duration-300 
            ${state === "collapsed" ? "opacity-100" : "opacity-0"}
          `}
        />
        {/* Expanded logo (UnifyLogo) */}
        <div
          className={`
            transition-opacity duration-300 
            ${state === "collapsed" ? "opacity-0" : "opacity-100"}
          `}
        >
          <UnifyLogo theme={resolvedTheme} />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="list-none flex flex-col h-full mt-5">
        {/* Main Nav */}
        <div className="flex-grow space-y-2">
          <SidebarMenu>
            {mainNavItems.map((item) =>
              renderMenuItem(item, isActive(item))
            )}
          </SidebarMenu>
        </div>

        {/* Profile at bottom: always visible */}
        <div className="mt-auto mb-2">
          <SidebarMenu>
            {renderMenuItem(profileItem, isActive(profileItem))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarSeparator />

      {/* Hide entire footer in collapsed mode */}
      {state === "collapsed" ? (
        <SidebarFooter className="flex flex-row items-center justify-between px-2 py-2">
          <DarkModeToggle />
        </SidebarFooter>
      ) : (
        <SidebarFooter className="flex flex-row items-center justify-between px-4 py-2">
          <SignOutButton />
          <DarkModeToggle />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}