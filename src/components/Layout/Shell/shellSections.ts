import { Settings } from 'lucide-react';
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
