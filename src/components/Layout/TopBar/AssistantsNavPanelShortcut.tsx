'use client';

import { AssistantInfoPanelShortcut } from '@/components/Layout/TopBar/AssistantInfoPanelShortcut';
import {
  OnboardingProgressShortcut,
  useCoordinatorOnboardingShortcutVisible,
} from '@/components/Layout/TopBar/OnboardingProgressShortcut';

import { tabToolbarIconButtonClass } from '@/components/Pages/Assistants/Common/TabToolbar';

/** Top-nav slot for assistants info panel access: onboarding progress when active, otherwise profile toggle. */
export function AssistantsNavPanelShortcut() {
  const showOnboardingShortcut = useCoordinatorOnboardingShortcutVisible();
  if (showOnboardingShortcut) return <OnboardingProgressShortcut />;
  return <AssistantInfoPanelShortcut buttonClassName={tabToolbarIconButtonClass} />;
}
