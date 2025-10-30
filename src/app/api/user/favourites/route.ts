import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/requireApiKey";
import { getFavourites } from "@/lib/interfaces/favourites";

export async function GET(req: NextRequest) {
  try {
    const apiKeyOrError = await requireApiKey(req);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const favourites = await getFavourites(apiKey);
    return NextResponse.json(favourites, { status: 200 });
  } catch (err) {
    console.error("/api/user/favourites error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 