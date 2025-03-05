import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";
import { headers } from "next/headers";
import Tour from "@/components/Navigation/Tour/Tour";
import NavMenu from "@/components/Navigation/NavBar/NavMenu";
import Providers from "@/components/Providers/Base";
import { ThemeProvider } from 'next-themes'
import { Suspense } from "react";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@/styles/globals.css";

import { SidebarTrigger } from "@/components/UI/sidebar"
import ThemeLoader from "@/components/ThemeLoader";
import LoadingScreen from "@/components/LoadingScreen";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen w-screen">
      <Suspense fallback={<LoadingScreen/>}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <ThemeLoader>
              <NavMenu/>
                <main className="overflow-hidden relative container min-h-full h-full max-w-full w-full flex flex-row bg-background">
                    <Tour buttonClassName="absolute top-2 right-3 bg-transparent hover:bg-primary z-50 opacity-50 hover:opacity-100"/>
                    <NuqsAdapter>
                      {children}
                    </NuqsAdapter>
                </main>
              </ThemeLoader>
            </Providers>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}