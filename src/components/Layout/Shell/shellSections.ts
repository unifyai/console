import { Settings, CreditCard, BarChart3, Building, Star } from 'lucide-react';
import type { SectionDef } from '@/components/Pages/Assistants/Rail/sectionConfig';

/** The Settings surface descriptor, used for the `/account` section header. */
export const SETTINGS_SECTION: SectionDef = {
  id: 'settings',
  label: 'Settings',
  Icon: Settings,
  kind: 'view',
  desc: 'Your account, contact info, security, organizations, usage and billing.',
  steps: [
    ['Edit your profile', 'Update your name, timezone and the bio your droids reference.'],
    ['Check usage', 'See your credit consumption broken down by day and droid.'],
    ['Manage billing', 'Review your plan, payment method and invoices.'],
  ],
};

/** The Billing surface descriptor, used for the `/billing` section header. */
export const BILLING_SECTION: SectionDef = {
  id: 'billing',
  label: 'Billing',
  Icon: CreditCard,
  kind: 'view',
  desc: 'Your plan, credits, payment methods and invoices.',
  steps: [
    ['Review your plan', 'See your current tier, renewal date and credit allowance.'],
    ['Manage payment', 'Add or update the card that backs renewals and top-ups.'],
    ['Download invoices', 'Open any past invoice or receipt from the list.'],
  ],
};

/** The Usage surface descriptor, used for the `/usage` section header. */
export const USAGE_SECTION: SectionDef = {
  id: 'usage',
  label: 'Usage',
  Icon: BarChart3,
  kind: 'view',
  desc: 'Your credit consumption over time, broken down by day and by droid.',
  steps: [
    ['Choose a range', 'Scope the chart by date and granularity.'],
    ['Filter by droid', 'See usage for all droids or just one.'],
    ['Drill into a day', 'Expand a day to see the work that spent the credits.'],
  ],
};

/** The Organizations surface descriptor, used for the `/organizations` header. */
export const ORGANIZATIONS_SECTION: SectionDef = {
  id: 'organizations',
  label: 'Organizations',
  Icon: Building,
  kind: 'view',
  desc: 'The teams you belong to — members, roles, teams and sharing.',
  steps: [
    ['Pick an organization', 'Switch between the organizations you belong to.'],
    ['Manage members', 'Invite people, set roles and review pending invites.'],
    ['Organize teams', 'Group members into teams and control resource sharing.'],
  ],
};

/** The Favourites surface descriptor, used for the `/favourites` header. */
export const FAVOURITES_SECTION: SectionDef = {
  id: 'favourites',
  label: 'Favourites',
  Icon: Star,
  kind: 'view',
  desc: 'Pin up to 10 projects to your dashboard for quick access.',
  steps: [
    ['Browse projects', 'Search the list and tick the projects you use most.'],
    ['Pick an icon', 'Give each favourite a recognisable icon.'],
    ['Reorder & save', 'Drag to set the order, then save to update your dashboard.'],
  ],
};

/**
 * Registry keyed by section id. Section descriptors carry an `Icon` component,
 * which cannot cross the server→client boundary as a prop. Server pages name a
 * section by its (serializable) id; the client shell resolves the descriptor
 * here so the icon component stays entirely within the client bundle.
 */
export const SHELL_SECTIONS = {
  settings: SETTINGS_SECTION,
  billing: BILLING_SECTION,
  usage: USAGE_SECTION,
  organizations: ORGANIZATIONS_SECTION,
  favourites: FAVOURITES_SECTION,
} as const;

export type ShellSectionId = keyof typeof SHELL_SECTIONS;
