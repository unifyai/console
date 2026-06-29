import {
  Building2,
  Tag,
  Receipt,
  Link2,
  Sparkles,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
}

/** Admin sub-rail entries. Each maps to a route under `/admin`. */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { id: 'overview', label: 'Overview', href: '/admin', Icon: LayoutGrid },
  {
    id: 'organizations',
    label: 'Organizations',
    href: '/admin/organizations',
    Icon: Building2,
  },
  { id: 'plans', label: 'Billing Plans', href: '/admin/plans', Icon: Tag },
  { id: 'invoices', label: 'Invoices', href: '/admin/invoices', Icon: Receipt },
  { id: 'links', label: 'Credit Grant Links', href: '/admin/links', Icon: Link2 },
  { id: 'demo', label: 'Demo Assistants', href: '/admin/demo', Icon: Sparkles },
] as const;

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}
