'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { SettingsAccountId } from './SettingsShell';
import {
  readAccountTabFromLocation,
  writeAccountTabToHistory,
} from '@/lib/navigation/settingsAccountTab';

interface SettingsNavigationContextValue {
  accountTab: SettingsAccountId;
  setAccountTab: (tab: SettingsAccountId) => void;
}

const SettingsNavigationContext = React.createContext<SettingsNavigationContextValue | null>(null);

export function SettingsNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onAccount = pathname === '/account';

  const [accountTab, setAccountTabState] = React.useState<SettingsAccountId>('profile');

  React.useLayoutEffect(() => {
    if (!onAccount) return;
    setAccountTabState(readAccountTabFromLocation());
  }, [onAccount, pathname]);

  React.useEffect(() => {
    if (!onAccount) return;
    const onPopState = () => {
      setAccountTabState(readAccountTabFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onAccount]);

  const setAccountTab = React.useCallback((tab: SettingsAccountId) => {
    setAccountTabState(tab);
    writeAccountTabToHistory(tab);
  }, []);

  const value = React.useMemo(() => ({ accountTab, setAccountTab }), [accountTab, setAccountTab]);

  return (
    <SettingsNavigationContext.Provider value={value}>
      {children}
    </SettingsNavigationContext.Provider>
  );
}

export function useSettingsNavigation(): SettingsNavigationContextValue {
  const ctx = React.useContext(SettingsNavigationContext);
  if (!ctx) {
    throw new Error('useSettingsNavigation must be used within SettingsNavigationProvider');
  }
  return ctx;
}
