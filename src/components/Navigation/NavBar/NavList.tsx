import { useMemo } from "react";
import { NavItem } from "@/types/navigation";
import {
  Key,
  MessageSquare,
  CreditCard,
  ChartLine,
  ArrowBigRightDash,
  ClipboardPen,
  TestTubeDiagonal,
  Gauge,
} from "lucide-react";

const NavList = (): NavItem[] => {
  // Just return your main nav items—do NOT include "Profile" here
  return [
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
    {
      title: "Evals",
      icon: ChartLine,
      href: "/evals",
    },
    {
      title: "Evals1",
      icon: ClipboardPen,
      href: "/evals1",
    },
    {
      title: "Datasets",
      icon: TestTubeDiagonal,
      href: "/datasets",
    },
    {
      title: "Usage",
      icon: Gauge,
      href: "/usage",
    },
    {
      title: "Billing",
      icon: CreditCard,
      href: "/billing",
    },
  ];
};

export default NavList;