import { Settings, CreditCard } from 'lucide-react';
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
