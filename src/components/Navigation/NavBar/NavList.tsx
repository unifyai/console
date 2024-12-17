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
  TestTubeDiagonal,
} from "lucide-react";

const NavList: NavItem[] = [
  {
    title: "Universal API",
    icon: Globe,
    href: "/evals",
    tabs: [
      {
        title: "Chat",
        icon: MessageSquare,
        href: "/chat?endpoints=chatgpt-4o-latest@openai&lastSelected=chatgpt-4o-latest@openai",
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
      {
        title: "Usage",
        icon: ChartLine,
        href: "/usage",
      },
    ],
  },
  {
    title: "Evals",
    icon: ClipboardPen,
    href: "/evals",
  },
  {
    title: "Datasets",
    icon: TestTubeDiagonal,
    href: "/datasets",
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
