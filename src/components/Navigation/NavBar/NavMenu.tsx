"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from 'next/navigation';
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
  useSidebar
} from "@/components/UI/sidebar";
import NavList from "./NavList";
import UnifyLogo from "@/components/Common/Misc/UnifyLogo";
import DarkModeToggle from "./DarkModeToggle";
import SignOutButton from "./SignOut";
import { NavItem } from "@/types/navigation";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/UI/collapsible";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export default function NavMenu() {
  const currentPath = usePathname();
  const { state } = useSidebar();
  const [universalApiOpen, setUniversalApiOpen] = useState(true);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Open Universal API group if the current path starts with '/universal-api'
    if (currentPath.startsWith('/universal-api')) {
      setUniversalApiOpen(true);
    }
  }, [currentPath]);

  const isActive = (item: NavItem) => {
    if (item.href === '/universal-api') {
      return currentPath.startsWith('/universal-api');
    }
    return currentPath === item.href;
  };

  const button = (item: NavItem) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <SidebarMenuButton asChild isActive={active}>
        <Link href={item.href} className={`flex items-center transition-colors ${active ? 'font-bold text-sidebar-accent-foreground ' : 'hover:text-sidebar-primary hover:bg-transparent'}`}>
          <Icon className={`w-5 h-5 ${active ? 'text-sidebar-accent-foreground' : ''}`} />
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
      <SidebarContent className="list-none">
        {NavList.map(item => item.tabs ? renderGroup(item) : renderMenuItem(item))}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="flex flex-row items-center justify-between px-4 py-2">
        <SignOutButton />
        <DarkModeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}