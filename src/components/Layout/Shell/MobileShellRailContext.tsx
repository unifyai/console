'use client';

import * as React from 'react';

interface MobileShellRailContextValue {
  isBelowMobile: boolean;
  openMobileRail: () => void;
}

const MobileShellRailContext = React.createContext<MobileShellRailContextValue | null>(null);

export function MobileShellRailProvider({
  value,
  children,
}: {
  value: MobileShellRailContextValue;
  children: React.ReactNode;
}) {
  return (
    <MobileShellRailContext.Provider value={value}>{children}</MobileShellRailContext.Provider>
  );
}

export function useMobileShellRail(): MobileShellRailContextValue | null {
  return React.useContext(MobileShellRailContext);
}
