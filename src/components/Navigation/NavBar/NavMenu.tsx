"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
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
import DarkModeToggle from "./DarkModeToggle";
import SignOutButton from "./SignOut";
import { NavItem } from "@/types/navigation";
import Link from "next/link";
import { getSession } from "@/lib/user/user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/UI/avatar";
import { useTheme } from "next-themes";
import ivyLogoOnly from "@/public/ivy_logo_only.png";
import Image from "next/image";
import { User, Menu, MoreHorizontal, HelpCircle, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import { Icon } from "@/components/UI/icon-picker";

/** A single nav item with an icon and label. */
function renderMenuItem(item: NavItem, isActive: boolean) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem key={item.title} className="px-2 py-1 transition-colors">
      <SidebarMenuButton asChild isActive={isActive}>
        <Link
          href={item.href}
          className={`flex items-center transition-colors rounded-sm ${
            isActive
              ? "font-bold text-primary-foreground bg-primary"
              : "hover:text-sidebar-primary hover:bg-transparent"
          }`}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? "text-primary-foreground" : ""
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, setOpen } = useSidebar();
  const { resolvedTheme } = useTheme();
  const [profileName, setProfileName] = useState("Profile");
  const [avatarJSX, setAvatarJSX] = useState<JSX.Element | null>(null);
  // Projects state will hold the user's favourite projects fetched from the backend
  type ProjectItem = { id: string; title: string; iconName: string; favId: number; position: number };
  const [projects, setProjects] = useState<ProjectItem[]>([]);

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

  // Fetch favourite projects on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/favourites", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          console.warn("Failed to fetch favourites", res.status, res.statusText);
          return;
        }

        const favourites = (await res.json()) as { id: number; project: string; icon: string; position: number }[];
        console.log("Favourites:", favourites);

        const mapped = favourites
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((fav) => ({
            id: fav.project, // use project name as unique id for DnD
            title: fav.project,
            iconName: fav.icon || "folder",
            favId: fav.id,
            position: fav.position ?? 0,
          }));
        setProjects(mapped);
      } catch (err) {
        console.error("Failed to fetch favourites for NavMenu", err);
      }
    })();
  }, []);

  /* ------------------------------------------------
   * Prefetch Interfaces routes for favourite projects
   * ------------------------------------------------
   * Once we have the list of favourite projects from the
   * backend, ask Next.js to pre‑fetch the corresponding
   * RSC payloads in the background. This means that when
   * the user eventually clicks a project shortcut the data
   * will already be in the router cache, resulting in a
   * near‑instant client‑side transition instead of what
   * feels like a full page reload.
   *
   * Note: `router.prefetch()` is safe to call multiple times
   * and it deduplicates calls internally. If you have a very
   * large number of favourites you might want to debounce or
   * limit these calls – but for the typical (<20) list it's
   * more than fine.
   */
  useEffect(() => {
    if (projects.length === 0) return;

    projects.forEach((p) => {
      const url = `/interfaces?project=${encodeURIComponent(p.title)}`;
      try {
        router.prefetch(url);
      } catch (_) {
        // router.prefetch can throw on the server – this is a
        // client component so we should be safe, but guard anyway.
      }
    });
  }, [projects, router]);

  // Set default collapsed state
  useEffect(() => {
    setOpen(false);
  }, []);

  const mainNavItems = NavList();
  // Split the nav items: keep Interfaces at top, others in the popover menu
  const [interfacesItem, ...otherNavItems] = mainNavItems;

  // The user profile nav item
  const profileItem: NavItem = {
    title: profileName,
    icon: avatarJSX ? () => avatarJSX : User,
    href: "/profile",
  };

  // Favourites page nav item (shown in popover tray)
  const favouritesNavItem: NavItem = {
    title: "Favourites",
    icon: Star,
    href: "/favourites",
  };

  // Highlight the active item
  const isActive = (item: NavItem) => {
    // Basic path check
    const pathMatch = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    
    // Special case for projects on the interfaces page
    if (item.href.startsWith('/interfaces?project=')) {
      // If we're on the interfaces page
      if (currentPath === '/interfaces') {
        // Extract project name from item href
        const itemProjectMatch = item.href.match(/project=([^&]*)/);
        const itemProject = itemProjectMatch ? decodeURIComponent(itemProjectMatch[1]) : null;
        
        // Get project from URL params
        const urlProject = searchParams.get('project');
        
        // Check if the URL project matches the item's project
        return itemProject === urlProject;
      }
      return false;
    }
    
    // For interfaces link, only make it active if there's no project parameter
    // or if no project in the nav menu matches the current project
    if (item.href === '/interfaces') {
      const urlProject = searchParams.get('project');
      
      // If there's no project parameter, interface link should be active
      if (!urlProject) return pathMatch;
      
      // If there's a project parameter, check if it matches any project in the nav menu
      const matchingProject = projects.some(p => p.title === urlProject);
      
      // Interface link should be active only if there's no matching project in the nav menu
      return pathMatch && !matchingProject;
    }
    
    // Default behavior for other links
    return pathMatch;
  };

  /* ---------------- Draggable list helpers ---------------- */
  const updateBackendPositions = async (items: ProjectItem[]) => {
    for (const p of items) {
      try {
        const res = await fetch(`/api/user/favourites/${p.favId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: p.position }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`Failed to update favourite ${p.title}:`, res.status, text);
        }
      } catch (err) {
        console.error(`Error updating favourite ${p.title}:`, err);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    const newItems = arrayMove(projects, oldIndex, newIndex).map((p, idx) => ({
      ...p,
      position: idx,
    }));

    setProjects(newItems);

    // Update backend asynchronously (fire and forget)
    updateBackendPositions(newItems);
  };

  // Add global styles for drag operation
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      /* Override any background colors during drag operation */
      [data-dnd-draggable-context-id] *,
      [data-sortable="true"] *,
      .sidebar-menu-item,
      .sidebar-menu-button {
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Sortable project item component
  const SortableProjectItem = ({ item }: { item: ProjectItem }) => {
    const { id, title, iconName } = item;
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    // Create a mock NavItem to check if this project is active
    const projectNavItem: NavItem = {
      title,
      icon: () => <Icon name={iconName as any} className="w-5 h-5" />,
      href: `/interfaces?project=${encodeURIComponent(title)}`
    };
    
    // Check if this project is the active one
    const isProjectActive = isActive(projectNavItem);

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition: transition || undefined,
      // Add explicit background style during dragging
      background: "transparent",
      backgroundColor: "transparent",
    };

    return (
      <SidebarMenuItem
        ref={setNodeRef as any}
        style={style}
        data-dragging={isDragging ? "true" : "false"}
        className={`px-2 py-1 select-none bg-transparent ${
          isDragging 
            ? "opacity-50 !bg-transparent [&_*]:!bg-transparent" 
            : "hover:text-sidebar-primary"
        }`}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton 
                asChild 
                className={`cursor-grab bg-transparent hover:bg-transparent ${
                  isProjectActive 
                    ? "bg-primary data-[active=true]:bg-primary"
                    : "data-[active=true]:bg-transparent"
                } ${
                  isDragging ? "!bg-transparent [&_*]:!bg-transparent" : "hover:text-sidebar-primary"
                }`}
                style={{ background: isProjectActive ? "var(--primary)" : "transparent", backgroundColor: isProjectActive ? "var(--primary)" : "transparent" }}
                isActive={isProjectActive}
                {...attributes} 
                {...listeners}
              >
                <Link
                  href={`/interfaces?project=${encodeURIComponent(title)}`}
                  className={`flex items-center w-full rounded-sm ${
                    isProjectActive
                      ? "font-bold text-primary-foreground bg-primary"
                      : "bg-transparent"
                  }`}
                  style={{ 
                    background: isProjectActive ? "var(--primary)" : "transparent", 
                    backgroundColor: isProjectActive ? "var(--primary)" : "transparent" 
                  }}
                >
                  {iconName && <Icon name={iconName as any} className={`w-5 h-5 ${
                    isDragging 
                      ? "bg-transparent text-primary" 
                      : isProjectActive 
                        ? "text-primary-foreground" 
                        : ""
                  }`} />}
                  <span className={`ml-2 group-data-[collapsible=icon]:hidden truncate ${
                    isDragging 
                      ? "bg-transparent" 
                      : isProjectActive 
                        ? "text-primary-foreground" 
                        : ""
                  }`}>
                    {title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar 
      collapsible="icon"
    >
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
        {/* Main Nav: only Interfaces */}
        <div className="flex-grow space-y-2">
          {/* Projects section label */}
          <div className="pl-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Projects
          </div>
          {/* Removed divider under Projects label as requested */}

          {/* Favourite projects list (or an empty‑state message) */}
          <SidebarMenu>
            {projects.length === 0 ? (
              <div className="px-3 py-1 flex gap-2 text-muted-foreground select-none">
                <HelpCircle
                  className="w-5 h-5 flex-shrink-0 cursor-pointer"
                  onClick={() => setOpen(true)}
                />
                {state === "expanded" && (
                  <div className="text-xs leading-snug whitespace-normal break-words">
                    <p>You have no favourite projects added. Add them <Link href="/favourites" className="text-primary">here</Link>.</p>
                  </div>
                )}
              </div>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={projects.map(p=>p.id)} strategy={verticalListSortingStrategy}>
                  {projects.map((p) => (
                    <SortableProjectItem key={p.id} item={p} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </SidebarMenu>
        </div>

        {/* Profile at bottom: always visible */}
        <div className="mt-auto mb-2">
          <SidebarMenu>
            {/* Fixed Interfaces nav item at bottom */}
            {interfacesItem && renderMenuItem(interfacesItem, isActive(interfacesItem))}

            {/* Popover trigger for the rest of the pages */}
            {otherNavItems.length > 0 && (
              <SidebarMenuItem className="px-2 py-1 transition-colors">
                <Popover>
                  <PopoverTrigger asChild>
                    <SidebarMenuButton asChild>
                      <div className="flex items-center cursor-pointer hover:text-sidebar-primary hover:bg-transparent">
                        <MoreHorizontal className="w-5 h-5" />
                        <span className="ml-2 group-data-[collapsible=icon]:hidden">
                          More
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="center" className="p-0">
                    <SidebarMenu className="p-2">
                      {[...otherNavItems, favouritesNavItem, profileItem].map((item) =>
                        renderMenuItem(item, isActive(item))
                      )}
                    </SidebarMenu>
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            )}
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