import React from "react";
import type { Metadata } from "next";
import { ThemeProvider } from 'next-themes'
import { SpeedInsights } from '@vercel/speed-insights/next';

import "@/styles/globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";

export const metadata: Metadata = {
  title: {
    template: "Unify Console: %s",
    default: "Unify Console",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}