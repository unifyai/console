import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";
import { getProjects } from "@/lib/interfaces/projects";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const fetchProjects = await getProjects(user.api_key);
    const projects = await fetchProjects();
    return NextResponse.json(projects, { status: 200 });
  } catch (err) {
    console.error("/api/user/projects error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 