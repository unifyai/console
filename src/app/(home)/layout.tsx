import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";
import { headers } from "next/headers";
import TopNav from "@/components/Layout/TopBar/TopNav";
import Providers from "@/components/Pages/Providers/Base";
import { ThemeProvider } from 'next-themes'
import { Suspense } from "react";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@/styles/globals.css";


import ThemeLoader from "@/components/Layout/ThemeLoader";
import LoadingScreen from "@/components/Layout/LoadingScreen";
import { Toaster } from "@/components/UI/Chat/sonner";
import OnboardingGuard from "@/components/Pages/TaxClassification/OnboardingGuard";
import { Loader2 } from "lucide-react";
import { fontSans, fontMono } from "@/styles/fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable} h-screen overflow-hidden`}>
      <body className="h-screen w-full overflow-hidden">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <ThemeLoader>
              <OnboardingGuard>
                <Suspense
                  fallback={
                    <div className="fixed top-0 left-0 right-0 h-10 bg-background/80 backdrop-blur-lg border-b border-[color:var(--border)] z-50 flex items-center px-3.5">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-caption text-muted-foreground">Loading…</span>
                    </div>
                  }
                >
                  <TopNav />
                </Suspense>
                <Suspense fallback={<LoadingScreen/>}>
                  <main className="relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden">
                    <NuqsAdapter>{children}</NuqsAdapter>
                  </main>
                </Suspense>
                <Toaster />
              </OnboardingGuard>
            </ThemeLoader>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}