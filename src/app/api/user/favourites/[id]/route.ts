import { NextRequest, NextResponse } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";
import { updateFavourite, deleteFavourite } from "@/lib/interfaces/favourites";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const apiKey = await getApiKeyFromRequest(req);
    if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const updateFav = await updateFavourite(apiKey);
    const updated = await updateFav(Number(params.id), body);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("/api/user/favourites/[id] PATCH error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const apiKey = await getApiKeyFromRequest(req);
    if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const deleteFav = await deleteFavourite(apiKey);
    const success = await deleteFav(Number(params.id));
    return NextResponse.json({ success }, { status: success ? 200 : 500 });
  } catch (err) {
    console.error("/api/user/favourites/[id] DELETE error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 