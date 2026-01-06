import { NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import authOptions from "./app/api/auth/[...nextauth]/pages";

export function middleware(request: NextRequestWithAuth, event: NextFetchEvent) {
    const { pathname, searchParams } = request.nextUrl;
    
    // Allow public access to shareable plot view pages (no auth required)
    if (pathname.startsWith('/plot/view/')) {
        return NextResponse.next();
    }
    
    // Default to "Assistants" project when visiting /interfaces with no project specified
    // This runs BEFORE the server component, avoiding a double-render
    if (pathname === '/interfaces') {
        const hasProject = searchParams.has('project');
        const selectProject = searchParams.get('selectProject');
        const selectInterface = searchParams.get('selectInterface');
        
        // Only redirect if:
        // - No project is specified
        // - User isn't explicitly choosing a project (selectProject=true)
        // - User isn't on interface selection screen
        if (!hasProject && selectProject !== 'true' && selectInterface !== 'true') {
            const url = request.nextUrl.clone();
            url.searchParams.set('project', 'Assistants');
            return NextResponse.redirect(url);
        }
    }
    
    if (request.url.includes("/user") && !request.headers.get("ADMIN_KEY"))
        return new Response("Unauthorized", { status: 403 });
    if (process.env.ON_PREM)
        return NextResponse.next();
    return withAuth({pages: authOptions.pages, secret: process.env.JWT_SECRET})(request, event);
}

export const config = {
    matcher: "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.jpe?g$|.*\\.svg$).*)",
}; 
