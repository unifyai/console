import React from 'react';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

import '@/styles/globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import 'yet-another-react-lightbox/styles.css';
import { fontSans, fontMono } from '@/styles/fonts';

export const metadata: Metadata = {
  title: {
    template: 'Unify Console: %s',
    default: 'Unify Console',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
