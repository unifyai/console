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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarSeparator,
  useSidebar,
} from "@/components/UI/sidebar";
import NavList from "./NavList";
import UnifyLogo from "@/components/Common/Misc/UnifyLogo";
import DarkModeToggle from "./DarkModeToggle";
import SignOutButton from "./SignOut";
import { NavItem } from "@/types/navigation";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/UI/collapsible";
import { ChevronRight, ChevronDown, User } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { getSession, getCurrentUser } from "@/lib/user/user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/UI/avatar";

export default function NavMenu() {
  const currentPath = usePathname();
  const { state } = useSidebar();
  const [universalApiOpen, setUniversalApiOpen] = useState(true);
  const { resolvedTheme } = useTheme();
  const mainNavItems = NavList();

  const [profileName, setProfileName] = useState("Profile");
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sessionData = await getSession();
        const userData = await getCurrentUser();
        const userName = userData?.name || sessionData?.user?.name || "Profile";
        const imageUrl = userData?.image || sessionData?.user?.image || "";

        setProfileName(userName);

        // Helper to get 1-2 letter fallback text
        const getInitials = (name: string) => {
          return name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
        };

        setAvatarJSX(
          <Avatar className="h-5 w-5">
            <AvatarImage src={imageUrl} alt="User Avatar" />
            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
          </Avatar>
        );
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    })();
  }, []);

  // Build a NavItem for the Profile link
  const profileItem: NavItem = {
    title: profileName,
    icon: avatarJSX ? () => avatarJSX : User,
    href: "/profile",
  };

  // Keep Universal API expanded if we’re on those routes
  useEffect(() => {
    if (currentPath.startsWith("/universal-api")) {
      setUniversalApiOpen(true);
    }
  }, [currentPath]);

  const isActive = (item: NavItem) => {
    if (item.href === "/universal-api") {
      return currentPath.startsWith("/universal-api");
    }
    return currentPath === item.href;
  };

  const button = (item: NavItem) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <SidebarMenuButton asChild isActive={active}>
        <Link
          href={item.href}
          className={`flex items-center transition-colors ${
            active
              ? "font-bold text-sidebar-accent-foreground"
              : "hover:text-sidebar-primary hover:bg-transparent"
          }`}
        >
          <Icon
            className={`w-5 h-5 ${
              active ? "text-sidebar-accent-foreground" : ""
            }`}
          />
          <span className="ml-2">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    );
  };

  const renderMenuItem = (item: NavItem) => (
    <SidebarMenuItem key={item.title} className="px-2 transition-colors">
      {button(item)}
    </SidebarMenuItem>
  );

  const renderGroup = (item: NavItem) => (
    <Collapsible
      key={item.title}
      className="group/collapsible"
      open={universalApiOpen}
      onOpenChange={setUniversalApiOpen}
    >
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="flex items-center justify-between cursor-pointer transition-colors hover:text-sidebar-primary">
            {item.title}
            <ChevronRight className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:hidden" />
            <ChevronDown className="w-4 h-4 transition-transform hidden group-data-[state=open]/collapsible:block" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="transition-all">
          <SidebarGroupContent className="pl-4 border-l border-sidebar-border">
            <SidebarMenu>
              {item.tabs?.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
  return (
    <Sidebar>
      <SidebarHeader>
        <UnifyLogo theme={resolvedTheme} />
      </SidebarHeader>
      <SidebarSeparator />

      <SidebarContent className="list-none flex flex-col h-full">
        <div className="flex-grow">
          {mainNavItems.map((item) =>
            item.tabs ? renderGroup(item) : renderMenuItem(item)
          )}
        </div>

        <div className="mt-auto mb-2">
          {renderMenuItem(profileItem)}
        </div>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="flex flex-row items-center justify-between px-4 py-2">
        <SignOutButton />
        <DarkModeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}