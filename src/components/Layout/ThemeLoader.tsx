'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import LoadingScreen from '@/components/Layout/LoadingScreen';

export default function ThemeLoader({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Show a full-screen overlay to avoid a blank flash before navbar/theme mount
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
