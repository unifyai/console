import { NextRequest, NextResponse } from "next/server";
import { cartesiaClient } from "@/lib/cartesia";
import { Voice } from "@/types/team/assistant";
import { Gender, LocalizeTargetLanguage } from "@cartesia/cartesia-js/api";

interface LocalizeRequestBody {
    baseCartesiaVoiceId: string;
    name: string;
    description?: string | null;
    targetLanguage: LocalizeTargetLanguage; // "en" | "de" | "es" | "fr" | "ja" | "pt" | "zh" | "hi" | "it" | "ko" | "nl" | "pl" | "ru" | "sv" | "tr"
    originalSpeakerGender: Gender; // "male" | "female"
}

export async function POST(request: NextRequest) {

    try {
        const body = await request.json() as LocalizeRequestBody;
        const { 
            baseCartesiaVoiceId, 
            name, 
            description, 
            targetLanguage, 
            originalSpeakerGender,
        } = body;

        if (!baseCartesiaVoiceId || !name || !description || !targetLanguage || !originalSpeakerGender) {
            return NextResponse.json({ detail: "Missing required fields for localization." }, { status: 400 });
        }

        const cartesiaResponse = await cartesiaClient.voices.localize({
            voiceId: baseCartesiaVoiceId,
            name,
            description: description,
            language: targetLanguage,
            originalSpeakerGender
        });

        const createdVoice: Voice = {
            voice_id: cartesiaResponse.id,
            name: cartesiaResponse.name,
            description: cartesiaResponse.description,
            language: cartesiaResponse.language || targetLanguage,
            gender: originalSpeakerGender,
        };
        
        return NextResponse.json(createdVoice, { status: 201 });

    } catch (error: any) {
        console.error("[API /voices/user/localize] Error:", error);
        if (error.response && error.response.data) {
            return NextResponse.json({ detail: error.response.data.message || "Cartesia API error during localization." }, { status: error.response.status || 500 });
        }
        return NextResponse.json({ detail: "Failed to localize voice. " + (error.message || "Unknown error") }, { status: 500 });
    }
}