import { NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import authOptions from "./app/api/auth/[...nextauth]/pages";

export function middleware(request: NextRequestWithAuth, event: NextFetchEvent) {
    if (request.url.includes("/user") && !request.headers.get("ADMIN_KEY"))
        return new Response("Unauthorized", { status: 403 });
    if (process.env.ON_PREM)
        return NextResponse.next();
    return withAuth({pages: authOptions.pages, secret: process.env.JWT_SECRET})(request, event);
}

export const config = {
    matcher: "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.jpe?g$|.*\\.svg$).*)",
}; 
