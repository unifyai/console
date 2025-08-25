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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen w-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <ThemeLoader>
              <OnboardingGuard>
                <TopNav />
                <Suspense fallback={<LoadingScreen/>}>
                  <main className="relative top-10 h-[calc(100vh-2.5rem)]">
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