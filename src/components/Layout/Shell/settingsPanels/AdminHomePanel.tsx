'use client';

import * as React from 'react';
import { Building2, ChevronRight, Link2, Receipt, Sparkles, Tag } from 'lucide-react';
import { Card } from '@/components/UI/card';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';

const tools = [
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
      'Catalog of BillingPlanTemplate rows and curated BillingPlanGroup bundles for self-serve plan switching.',
    Icon: Tag,
  },
  {
    href: '/admin/invoices',
    title: 'Invoices',
    blurb:
      'All invoices across billing accounts, including historical recharges and projected month-end totals.',
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
    blurb: 'Assistants used for demos and lead generation.',
    Icon: Sparkles,
  },
];

export default function AdminHomePanel() {
  const { navigateTo } = useAppShellNavigation();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-2 overflow-auto p-4">
        {tools.map(({ href, title, blurb, Icon }) => (
          <button
            key={href}
            type="button"
            onClick={() => navigateTo(href)}
            className="block w-full text-left"
          >
            <Card className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-primary-tint-40">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-title text-semibold">{title}</div>
                <p className="text-body-sm truncate text-muted-foreground">{blurb}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
