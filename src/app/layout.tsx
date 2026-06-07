import React from 'react';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

import '@/styles/globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import 'yet-another-react-lightbox/styles.css';
import { fontSans, fontMono, fontSerif } from '@/styles/fonts';
import { LandingEventBeacon } from '@/components/Integrations/LandingEventBeacon';

export const metadata: Metadata = {
  title: {
    template: 'Unify Console: %s',
    default: 'Unify Console',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <LandingEventBeacon />
        </ThemeProvider>
      </body>
    </html>
  );
}
