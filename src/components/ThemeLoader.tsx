"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

export default function ThemeLoader({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <SkeletonLoader />;
  }

  return <>{children}</>;
}