import { NavItem } from "@/types/navigation";
import {
  LayoutDashboard, // For Interfaces
  Users,           // For Assistants
  CreditCard,      // For Billing
  ChartLine,       // For the static Usage project link (though defined in NavMenu)
} from "lucide-react";

const NavList = (): NavItem[] => {
  // Defines the main navigation items that will be structured in NavMenu
  return [
    // Temporarily hide Assistants page
    // {
    //   title: "Assistants",
    //   icon: Users,
    //   href: "/assistants",
    // },
    {
      title: "Interfaces",
      icon: LayoutDashboard, // This will be the main collapsible "Interfaces"
      href: "/interfaces",
    },
    {
      title: "Billing",
      icon: CreditCard,
      href: "/billing",
    },
    // Note: "Profile" is handled separately in NavMenu.
    // "Usage", "Chat", "Keys", "Endpoints" are removed as per requirements.
    // The static "Usage" project link (/interfaces?project=Usage) will be defined directly in NavMenu.
  ];
};

export default NavList;