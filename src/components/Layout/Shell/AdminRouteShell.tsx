'use client';

import * as React from 'react';
import { SettingsShell } from './SettingsShell';

/**
 * Wraps all `/admin` routes in the shared settings shell so admin surfaces
 * keep the same sub-rail, header chrome, and cross-links as `/account`,
 * `/usage`, and `/billing`.
 */
export function AdminRouteShell({ children }: { children: React.ReactNode }) {
  return (
    <SettingsShell sectionId="admin" fill>
      {children}
    </SettingsShell>
  );
}
