import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";
import { headers } from "next/headers";
import NavMenu from "@/components/Navigation/NavBar/NavMenu";
import Providers from "@/components/Providers/Base";
import { ThemeProvider } from 'next-themes'
import { Suspense } from "react";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@/styles/globals.css";

import { SidebarInset } from "@/components/UI/sidebar";
import ThemeLoader from "@/components/ThemeLoader";
import LoadingScreen from "@/components/LoadingScreen";
import { Toaster } from "@/components/UI/Chat/sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen w-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <ThemeLoader>
              <NavMenu/>
              <SidebarInset>
                <Suspense fallback={<LoadingScreen/>}>
                  <main className="overflow-hidden relative container min-h-full h-full max-w-full w-full flex flex-row bg-background">
                    <NuqsAdapter>{children}</NuqsAdapter>
                  </main>
                </Suspense>
              </SidebarInset>
              <Toaster />
            </ThemeLoader>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}