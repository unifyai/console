import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

import { NavItem } from "@/types/navigation";
// Importing icons as components
import {
  Key,
  MessageSquare,
  CreditCard,
  ChartLine,
  ArrowBigRightDash,
  Globe,
  ClipboardPen,
} from "lucide-react";

const NavList: NavItem[] = [
  {
    title: "Universal API",
    icon: Globe,
    href: "/projects",
    tabs: [
      {
        title: "Chat",
        icon: MessageSquare,
        href: "/chat",
      },
      {
        title: "Keys",
        icon: Key,
        href: "/keys",
      },
      {
        title: "Endpoints",
        icon: ArrowBigRightDash,
        href: "/endpoints",
      },
    ],
  },
  {
    title: "Projects",
    icon: ClipboardPen,
    href: "/projects",
  },
  {
    title: "Usage",
    icon: ChartLine,
    href: "/usage",
  },
  {
    title: "Billing",
    icon: CreditCard,
    href: "/billing",
  },
  {
    title: "Profile",
    icon: AccountCircleOutlinedIcon,
    href: "/profile",
  },
];

export default NavList;