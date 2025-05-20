import { NextRequest, NextResponse } from "next/server";
import { cartesiaClient } from "@/lib/cartesia";
import { Voice } from "@/types/team/assistant";
import { SupportedLanguage } from "@cartesia/cartesia-js/api";

export async function POST(request: NextRequest) {

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const name = formData.get("name") as string | null;
        const description = formData.get("description") as string | null;
        const language = formData.get("language") as SupportedLanguage ;
        const gender = formData.get("gender") as string | null;

        if (!file) {
            return NextResponse.json({ detail: "Audio file is required." }, { status: 400 });
        }
        if (!name) {
            return NextResponse.json({ detail: "Voice name is required." }, { status: 400 });
        }
        if (!language) {
            return NextResponse.json({ detail: "Language is required." }, { status: 400 });
        }

        const cartesiaResponse = await cartesiaClient.voices.clone(file, {
            name,
            description: description || undefined,
            language,
            mode: "stability",
        });
        
        const createdVoice: Omit<Voice, "gender"> = {
            voice_id: cartesiaResponse.id,
            name: cartesiaResponse.name,
            description: cartesiaResponse.description,
            language: cartesiaResponse.language || language,
        };

        return NextResponse.json(createdVoice, { status: 201 });

    } catch (error: any) {
        console.error("[API /voices/user/clone] Error:", error);
        if (error.response && error.response.data) {
            return NextResponse.json({ detail: error.response.data.message || "Cartesia API error during cloning." }, { status: error.response.status || 500 });
        }
        return NextResponse.json({ detail: "Failed to clone voice. " + (error.message || "Unknown error") }, { status: 500 });
    }
}