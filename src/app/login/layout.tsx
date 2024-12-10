import React, { Suspense } from "react";
import type { Metadata } from "next";
import BaseLayout from "@/components/Providers/Base";
import Scaffold from "@/components/LandingNav/Scaffold";

export const metadata: Metadata = {
  title: "Login",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Scaffold
      footer={false}
    >
      <BaseLayout>
        <Suspense>
          {children}
        </Suspense>
      </BaseLayout>
    </Scaffold>
  );
}
