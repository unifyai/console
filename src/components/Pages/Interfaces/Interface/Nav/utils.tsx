'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/UI/icon-picker';

/**
 * Helper to render emoji vs lucide icon with defaults.
 * Shared across Nav components.
 */
export function renderSidebarIcon(
  iconStr: string | undefined | null,
  className: string,
  type: 'project' | 'interface' | 'tab' = 'tab'
) {
  // Default icons for each type
  const defaultIcons: Record<string, string> = {
    project: 'folder',
    interface: 'layout-grid',
    tab: 'square',
  };

  // Ensure we have a valid type
  const validType = type in defaultIcons ? type : 'tab';
  const defaultIcon = defaultIcons[validType];

  // Clean and validate the icon string
  let icon = iconStr;
  if (
    !icon ||
    typeof icon !== 'string' ||
    icon.trim() === '' ||
    icon === 'null' ||
    icon === 'undefined' ||
    icon === 'none'
  ) {
    icon = defaultIcon;
  } else {
    icon = icon.trim();
  }

  // Check if it's an emoji or special character
  if (/[^a-zA-Z0-9_-]/.test(icon)) {
    return <span className={cn(className, 'inline-flex items-center justify-center')}>{icon}</span>;
  }

  // Simple mapping: if icon is "tab", use the default
  if (icon.toLowerCase() === 'tab') {
    icon = defaultIcon;
  }

  // Just render the icon directly
  return <Icon name={icon as any} className={className} />;
}
