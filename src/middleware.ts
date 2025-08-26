import { NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import authOptions from "./app/api/auth/[...nextauth]/pages";

export function middleware(request: NextRequestWithAuth, event: NextFetchEvent) {
    return NextResponse.next();
}

export const config = {
    matcher: "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.jpe?g$|.*\\.svg$).*)",
}; 
