import React from 'react';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

import '@unity/brand/tokens.css';
import '@/styles/globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import 'yet-another-react-lightbox/styles.css';
import { brandFontVariables } from '@/styles/fonts';
import { LandingEventBeacon } from '@/components/Integrations/LandingEventBeacon';

export const metadata: Metadata = {
  title: {
    template: 'Unify Console: %s',
    default: 'Unify Console',
  },
  icons: {
    icon: [{ url: '/icon.svg?v=neo-unity', type: 'image/svg+xml' }],
    shortcut: [{ url: '/icon.svg?v=neo-unity', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const selfHostDeployEpoch =
    process.env.SELF_HOST_DEPLOY_EPOCH || process.env.NEXT_PUBLIC_SELF_HOST_DEPLOY_EPOCH || '';

  return (
    <html lang="en" suppressHydrationWarning className={brandFontVariables}>
      <body>
        {selfHostDeployEpoch ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
try {
  var epochKey = 'console:self-host:deploy-epoch';
  var reloadKey = 'console:self-host:deploy-epoch-reloaded';
  var nextEpoch = ${JSON.stringify(selfHostDeployEpoch)};
  if (window.localStorage.getItem(epochKey) !== nextEpoch) {
    var alreadyReloaded = window.sessionStorage.getItem(reloadKey) === nextEpoch;
    for (var i = window.localStorage.length - 1; i >= 0; i -= 1) {
      var key = window.localStorage.key(i);
      if (key && key.indexOf('console:assistants:') === 0) {
        window.localStorage.removeItem(key);
      }
    }
    window.sessionStorage.clear();
    window.localStorage.setItem(epochKey, nextEpoch);
    if (!alreadyReloaded) {
      window.sessionStorage.setItem(reloadKey, nextEpoch);
      var reload = function () {
        window.location.reload();
      };
      var cleanupTasks = [];
      if ('caches' in window) {
        cleanupTasks.push(
          window.caches.keys().then(function (keys) {
            return Promise.all(
              keys.map(function (key) {
                return window.caches.delete(key);
              })
            );
          })
        );
      }
      if (navigator.serviceWorker) {
        cleanupTasks.push(
          navigator.serviceWorker.getRegistrations().then(function (registrations) {
            return Promise.all(
              registrations.map(function (registration) {
                return registration.unregister();
              })
            );
          })
        );
      }
      if (cleanupTasks.length > 0) {
        Promise.allSettled(cleanupTasks).then(reload);
      } else {
        reload();
      }
    }
  }
} catch (_) {}
`,
            }}
          />
        ) : null}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <LandingEventBeacon />
        </ThemeProvider>
      </body>
    </html>
  );
}
