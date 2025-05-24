import { NextRequest, NextResponse } from "next/server";
import { cartesiaClient } from "@/lib/cartesia";

export async function DELETE(
    request: NextRequest,
    { params }: { params: { voiceId: string } } // This voiceId is the Cartesia Voice ID
) {

    const cartesiaVoiceIdToDelete = params.voiceId;

    if (!cartesiaVoiceIdToDelete) {
        return NextResponse.json({ detail: "Voice ID is required for deletion." }, { status: 400 });
    }
    
    try {
        await cartesiaClient.voices.delete(cartesiaVoiceIdToDelete);

        return new NextResponse(null, { status: 204 }); // Successfully deleted

    } catch (error: any) {
        console.error(`[API /voices/user/${cartesiaVoiceIdToDelete}] DELETE Error:`, error);
         if (error.response && error.response.data) {
            if (error.response.status === 404) {
                 return NextResponse.json({ info: "Voice not found on Cartesia, assumed already deleted." }, { status: 200 });
            }
            return NextResponse.json({ detail: error.response.data.message || "Cartesia API error during deletion." }, { status: error.response.status || 500 });
        }
        return NextResponse.json({ detail: "Failed to delete voice. " + (error.message || "Unknown error") }, { status: 500 });
    }
}