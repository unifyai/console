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
  SidebarTrigger,
  useSidebar,
} from "@/components/UI/sidebar";
import NavList from "./NavList";
import UnifyLogo from "@/components/Common/Misc/UnifyLogo";
import UnifyIcon from "@/components/Common/Misc/UnifyIcon";
import DarkModeToggle from "./DarkModeToggle";
import SignOutButton from "./SignOut";
import { NavItem } from "@/types/navigation";
import Link from "next/link";
import { getSession } from "@/lib/user/user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/UI/avatar";
import { useTheme } from "next-themes";
import ivyLogoOnly from "@/public/ivy_logo_only.png";
import Image from "next/image";
import { User, Menu } from "lucide-react";
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
  const { state, setOpen } = useSidebar();
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

  // Set default collapsed state
  useEffect(() => {
    setOpen(false);
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
    <Sidebar 
      collapsible="icon"
    >
      {/* SidebarHeader with crossfade logos */}
      <SidebarHeader className="relative h-12 w-full flex items-center justify-center">
        <div className="relative flex items-center justify-center h-full w-full">
          {/* Collapsed logo (using UnifyIcon) */}
          <div 
            className={`
              absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2
              transition-opacity duration-300 ease-in-out
              ${state === "collapsed" ? "opacity-100 z-10" : "opacity-0 z-0"}
            `}
          >
            <UnifyIcon height={24} width={24} />
          </div>
          
          {/* Expanded logo (UnifyLogo) */}
          <div
            className={`
              absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2
              transition-opacity duration-300 ease-in-out
              ${state === "expanded" ? "opacity-100 z-10" : "opacity-0 z-0"}
            `}
          >
            <UnifyLogo theme={resolvedTheme} />
          </div>
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

      {/* Footer with trigger, theme toggle, and sign out buttons */}
      <SidebarFooter className="flex flex-row items-center px-2 py-2 gap-2">
        {/* Sidebar trigger (always visible) */}
        <SidebarTrigger 
          className="h-8 w-8 opacity-80 hover:opacity-100"
        >
          <Menu className="h-4 w-4" />
        </SidebarTrigger>
        
        {/* Only show these when expanded */}
        {state === "expanded" && (
          <div className="flex items-center gap-2 ml-auto">
            <DarkModeToggle />
            <SignOutButton />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}