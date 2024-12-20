import { useMemo } from "react";
import { NavItem } from "@/types/navigation";
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
import React from "react";

const NavList = (): NavItem[] => {
  // Just return your main nav items—do NOT include "Profile" here
  return [
    {
      title: "Universal API",
      icon: Globe,
      href: "/evals",
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
      title: "Billing",
      icon: CreditCard,
      href: "/billing",
    },
  ];
};

export default NavList;