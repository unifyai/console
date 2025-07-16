import React from "react";
import Script from "next/script";
import { SessionProvider } from "./SessionProvider"; 
import QueryProvider from "./QueryProvider";
import { NextUIProvider } from "@nextui-org/react";
import { SidebarProvider } from "@/components/UI/sidebar"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NextUIProvider className="flex flex-col h-full flex-1">
        <SidebarProvider>
          <SessionProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </SessionProvider>
        </SidebarProvider>
      </NextUIProvider>
      <Script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
      <Script id="ganalytics">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-XXXXXXXXXX');
          `}
      </Script>
    </>
  );
}