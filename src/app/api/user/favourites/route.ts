import { NextRequest, NextResponse } from "next/server";
import { getFavourites } from "@/lib/interfaces/favourites";

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("apiKey");
    
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }
    
    const favourites = await getFavourites(apiKey);
    return NextResponse.json(favourites, { status: 200 });
  } catch (err) {
    console.error("/api/user/favourites error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
