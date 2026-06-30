/**
 * Admin Index
 *
 * Lightweight landing page that links to the available admin tools.
 * This isn't a full nav system — it's just the discovery surface for
 * Unify admins so the new managed-billing pages aren't URL-only.
 *
 * Access: Unify organization Owner or Admin only (enforced by the
 * /admin layout).
 */

import * as React from 'react';
import Link from 'next/link';
import { Building2, Tag, Sparkles, Link2, ChevronRight, Receipt } from 'lucide-react';
import { Card } from '@/components/UI/card';

interface AdminTool {
  href: string;
  title: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TOOLS: AdminTool[] = [
  {
    href: '/admin/organizations',
    title: 'Organizations',
    blurb:
      'Browse / search orgs, toggle free-trial + verification, manage credits & freeze, invite users, and manage billing plan assignments.',
    Icon: Building2,
  },
  {
    href: '/admin/plans',
    title: 'Billing Plans & Groups',
    blurb:
      'Catalog of BillingPlanTemplate rows (create / deprecate / multi-currency) and curated BillingPlanGroup bundles that scope the customer-facing self-serve plan switch.',
    Icon: Tag,
  },
  {
    href: '/admin/invoices',
    title: 'Invoices',
    blurb:
      'All invoices across billing accounts — historical recharges plus projected month-end totals for active METERED plans, with filters by status, currency, plan, and date range.',
    Icon: Receipt,
  },
  {
    href: '/admin/links',
    title: 'One-time Credit Grant Links',
    blurb: 'Generate one-time tokens to grant credits to new users via a claim link.',
    Icon: Link2,
  },
  {
    href: '/admin/demo',
    title: 'Demo Assistants',
    blurb: 'Assistants used for demos and engaging lead generation.',
    Icon: Sparkles,
  },
];

export default function AdminIndexPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-2 overflow-auto p-4">
        {TOOLS.map(({ href, title, blurb, Icon }) => (
          <Link key={href} href={href} className="block">
            <Card className="hover:border-primary/40 flex items-center gap-3 px-3 py-2.5 transition-colors">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-title text-semibold">{title}</div>
                <p className="text-body-sm truncate text-muted-foreground">{blurb}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
