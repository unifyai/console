"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import React from "react";

type Props = React.PropsWithChildren<{
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number | false;
}>;

export function SessionProvider({
  children,
  refetchOnWindowFocus = false,
  refetchInterval = 0,
}: Props) {
  return (
    <NextAuthSessionProvider
      refetchOnWindowFocus={refetchOnWindowFocus}
      refetchInterval={refetchInterval as number}
    >
      {children}
    </NextAuthSessionProvider>
  );
}