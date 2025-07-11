import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";
import { getFavourites } from "@/lib/interfaces/favourites";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const favourites = await getFavourites(user.apiKey);
    return NextResponse.json(favourites, { status: 200 });
  } catch (err) {
    console.error("/api/user/favourites error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 