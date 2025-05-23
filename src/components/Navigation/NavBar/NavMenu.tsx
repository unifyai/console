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
import NavListSource from "./NavList";
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
import { User, Menu, HelpCircle, Star, ChevronDown, ChevronRight, ChartLine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/UI/icon-picker";
import { toast } from "sonner"; // Added toast import

/** A single nav item with an icon and label. */
function renderMenuItem(item: NavItem, isActive: boolean, isSubItem: boolean = false, sidebarState?: string) {
  const IconComponent = item.icon;
  // Specific condition for hiding the Usage icon when the main sidebar is collapsed
  const hideIconWhenSidebarCollapsed = item.title === "Usage" && sidebarState === "collapsed";

  return (
    <SidebarMenuItem key={item.title} className={`px-2 py-1 transition-colors ${isSubItem ? "group-data-[collapsible=icon]:py-0.5 group-data-[collapsible=icon]:px-1.5" : ""}`}>
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
                  <IconComponent
                    className={`w-5 h-5 ${
                      isActive ? "text-primary-foreground" : ""
                    } ${hideIconWhenSidebarCollapsed ? "hidden" : ""}`} 
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

/** A collapsible nav item header. */
function renderCollapsibleMenuItemHeader(
  item: NavItem,
  isActive: boolean,
  isExpanded: boolean,
  toggleExpand: () => void
) {
  const ItemIcon = item.icon;
  return (
    <SidebarMenuItem className="px-2 py-1 transition-colors">
      <div className="flex items-center w-full">
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={`flex-grow items-center transition-colors rounded-sm ${
            isActive
              ? "font-bold text-primary-foreground bg-primary"
              : "hover:text-sidebar-primary hover:bg-transparent"
          }`}
        >
          <Link
            href={item.href}
            className="flex items-center"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ItemIcon
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
        <button
          onClick={toggleExpand}
          className="p-1 ml-1 group-data-[collapsible=icon]:hidden hover:bg-muted rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={isExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
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
  
  type ProjectItem = { id: string; title: string; iconName: string; favId: number; position: number };
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [initialProjectsSnapshot, setInitialProjectsSnapshot] = useState<ProjectItem[]>([]); // For reverting optimistic updates
  const [isInterfacesExpanded, setIsInterfacesExpanded] = useState(true);


  useEffect(() => {
    (async () => {
      try {
        const sessionData = await getSession();
        const userName = sessionData?.user?.name || "Profile";
        const imageUrl = sessionData?.user?.image || "";
        setProfileName(userName);
        const getInitials = (name: string) => name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/favourites", { method: "GET", cache: "no-store" });
        if (!res.ok) {
          console.warn("Failed to fetch favourites", res.status, res.statusText);
          return;
        }
        const favourites = (await res.json()) as { id: number; project: string; icon: string; position: number }[];
        const mapped = favourites
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((fav) => ({
            id: fav.project, 
            title: fav.project,
            iconName: fav.icon || "folder",
            favId: fav.id,
            position: fav.position ?? 0,
          }));
        setProjects(mapped);
        setInitialProjectsSnapshot(mapped); // Store initial state for revert
      } catch (err) {
        console.error("Failed to fetch favourites for NavMenu", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    projects.forEach((p) => {
      const url = `/interfaces?project=${encodeURIComponent(p.title)}`;
      try { router.prefetch(url); } catch (_) { /* ignore prefetch errors */ }
    });
  }, [projects, router]);

  useEffect(() => {
    setOpen(false); 
  }, []); 

  const navItemsFromList = NavListSource();
  const teamItem = navItemsFromList.find(item => item.title === "Team");
  const interfacesMainItem = navItemsFromList.find(item => item.title === "Interfaces");
  const billingItem = navItemsFromList.find(item => item.title === "Billing");

  const profileItem: NavItem = {
    title: profileName,
    icon: avatarJSX ? () => avatarJSX : User,
    href: "/profile",
  };

  const usageProjectItem: NavItem = {
    title: "Usage",
    icon: ChartLine,
    href: "/interfaces?project=Usage",
  };

  const isActive = (item: NavItem) => {
    const currentUrlProject = searchParams.get('project');
    if (item.href.startsWith('/interfaces?project=')) {
      const itemProjectMatch = item.href.match(/project=([^&]*)/);
      const itemProjectName = itemProjectMatch ? decodeURIComponent(itemProjectMatch[1]) : null;
      return currentPath === '/interfaces' && itemProjectName === currentUrlProject;
    }
    if (item.href === '/interfaces' && item.title === "Interfaces") {
      return currentPath === '/interfaces' && !currentUrlProject;
    }
    const pathMatch = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    return pathMatch;
  };

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
    setInitialProjectsSnapshot(newItems); // Update snapshot after reorder
    updateBackendPositions(newItems);
  };
  
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
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

  const handleUnfavourite = async (favIdToRemove: number, projectTitle: string) => {
    const projectToRemove = projects.find(p => p.favId === favIdToRemove);
    if (!projectToRemove) return;

    // Optimistic update
    setProjects(prev => prev.filter(p => p.favId !== favIdToRemove));

    try {
      const res = await fetch(`/api/user/favourites/${favIdToRemove}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Revert UI and show error
        setProjects(initialProjectsSnapshot); // Revert to last known good state before this attempt
        console.error(`Failed to remove favourite ${projectTitle}:`, res.status, await res.text());
        toast.error(`Could not remove ${projectTitle} from favourites.`);
      } else {
        toast.success(`${projectTitle} removed from favourites.`);
        // Update snapshot after successful deletion
        setInitialProjectsSnapshot(prev => prev.filter(p => p.favId !== favIdToRemove));
      }
    } catch (err) {
      // Revert UI and show error
      setProjects(initialProjectsSnapshot); // Revert to last known good state
      console.error(`Error removing favourite ${projectTitle}:`, err);
      toast.error(`Error removing ${projectTitle}.`);
    }
  };


  const SortableProjectItem = ({ item, onUnfavouriteClick }: { item: ProjectItem; onUnfavouriteClick: (favId: number, title: string) => void; }) => {
    const { id, title, iconName } = item;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const projectNavItem: NavItem = {
      title,
      icon: () => <Icon name={iconName as any} className="w-5 h-5" />,
      href: `/interfaces?project=${encodeURIComponent(title)}`
    };
    const isProjectActive = isActive(projectNavItem);

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition: transition || undefined,
      background: "transparent", 
      backgroundColor: "transparent",
    };

    return (
      <SidebarMenuItem
        ref={setNodeRef as any}
        style={style}
        data-dragging={isDragging ? "true" : "false"}
        // Note: px-2 py-1 is default from SidebarMenuItem, flex helps align star
        className={`select-none bg-transparent flex items-center justify-between group px-2 py-1 
          ${ isDragging ? "opacity-50 !bg-transparent [&_*]:!bg-transparent" : "" }`}
      >
        <div className="flex-grow min-w-0"> {/* min-w-0 for proper truncation with flex */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton 
                  asChild 
                  className={`cursor-grab bg-transparent w-full hover:bg-transparent 
                    ${ isProjectActive ? "bg-primary data-[active=true]:bg-primary" : "data-[active=true]:bg-transparent" } 
                    ${ isDragging ? "!bg-transparent [&_*]:!bg-transparent" : "hover:text-sidebar-primary" }`}
                  style={{ background: isProjectActive ? "var(--primary)" : "transparent", backgroundColor: isProjectActive ? "var(--primary)" : "transparent" }}
                  isActive={isProjectActive}
                  {...attributes} 
                  {...listeners}
                >
                  <Link
                    href={`/interfaces?project=${encodeURIComponent(title)}`}
                    className={`flex items-center w-full rounded-sm 
                      ${ isProjectActive ? "font-bold text-primary-foreground bg-primary" : "bg-transparent" }`}
                    style={{ background: isProjectActive ? "var(--primary)" : "transparent", backgroundColor: isProjectActive ? "var(--primary)" : "transparent" }}
                  >
                    {iconName && <Icon name={iconName as any} className={`w-5 h-5 flex-shrink-0 ${
                      isDragging ? "bg-transparent text-primary" 
                      : isProjectActive ? "text-primary-foreground" : ""
                    }`} />}
                    <span className={`ml-2 group-data-[collapsible=icon]:hidden truncate ${
                      isDragging ? "bg-transparent" 
                      : isProjectActive ? "text-primary-foreground" : ""
                    }`}>
                      {title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent side="right"><p>{title}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUnfavouriteClick(item.favId, item.title)}
                className="p-1 ml-1 text-muted-foreground hover:text-primary focus:outline-none group-data-[collapsible=icon]:hidden flex-shrink-0"
                aria-label={`Remove ${item.title} from favourites`}
              >
                <Star className="w-4 h-4" fill="currentColor"/>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>{`Remove ${item.title} from favourites`}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative h-12 w-full flex items-center justify-center overflow-hidden">
        <Image
          src={ivyLogoOnly}
          alt="Logo (collapsed)"
          priority
          className={`absolute h-5 w-5 object-contain transition-opacity duration-300 ${state === "collapsed" ? "opacity-100" : "opacity-0"}`}
        />
        <div className={`transition-opacity duration-300 ${state === "collapsed" ? "opacity-0" : "opacity-100"}`}>
          <UnifyLogo theme={resolvedTheme} />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="list-none flex flex-col h-full mt-5">
        <div className="flex-grow space-y-1">
          {teamItem && renderMenuItem(teamItem, isActive(teamItem))}
          
          {interfacesMainItem && (
            <>
              {renderCollapsibleMenuItemHeader(
                interfacesMainItem,
                isActive(interfacesMainItem),
                isInterfacesExpanded,
                () => setIsInterfacesExpanded(!isInterfacesExpanded)
              )}
              {isInterfacesExpanded && (
                <div className="pl-5 group-data-[collapsible=icon]:pl-0">
                  <SidebarMenu className="space-y-0.5">
                    
                    {state === "expanded" && (
                        <div className="pl-1.5 pt-2 pb-1 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                            Favourites
                        </div>
                    )}

                    {renderMenuItem(usageProjectItem, isActive(usageProjectItem), true, state)}
                    
                    {projects.length > 0 && state === "expanded" && (
                      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={projects.map(p=>p.id)} strategy={verticalListSortingStrategy}>
                          {projects.map((p) => (
                            <SortableProjectItem key={p.id} item={p} onUnfavouriteClick={handleUnfavourite} />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </SidebarMenu>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mb-2"> 
          <SidebarMenu>
            {profileItem && renderMenuItem(profileItem, isActive(profileItem))}
            {billingItem && renderMenuItem(billingItem, isActive(billingItem))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="flex flex-row items-center px-2 py-2 gap-2">
        <SidebarTrigger className="h-8 w-8 opacity-80 hover:opacity-100">
          <Menu className="h-4 w-4" />
        </SidebarTrigger>
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