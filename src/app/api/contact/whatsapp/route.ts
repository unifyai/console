import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const COMMUNICATION_URL = process.env.COMMUNICATION_URL;

export async function POST(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in POST /api/contact/whatsapp:", error);
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { phoneNumber, firstName, lastName } = requestBody;
    if (!phoneNumber || !firstName || !lastName) {
        return NextResponse.json({ detail: "Missing required fields: phoneNumber, firstName, lastName" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${COMMUNICATION_URL}/whatsapp/create`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ phoneNumber, firstName, lastName })
            }
        );

        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from communication service (whatsapp/create):", e);
            return { detail: "Invalid JSON response from communication service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Communication Service Error (whatsapp/create - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to create WhatsApp sender via communication service" }, { status: response.status });
        }
        
        // Assuming the backend /whatsapp/create returns { "sid": "..." } on success
        if (responseData.sid) {
            return NextResponse.json({ sid: responseData.sid }, { status: 201 });
        } else {
            console.error("Communication service (whatsapp/create) did not return expected 'sid' data:", responseData);
            return NextResponse.json({ detail: "Failed to create WhatsApp sender, unexpected response from service." }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Error proxying to communication service (whatsapp/create):", error);
        return NextResponse.json({ detail: "Failed to connect to communication service", errorDetails: error.message }, { status: 503 });
    }
}

export async function DELETE(request: NextRequest) {
    const apiKey = request.headers.get("apiKey"); // For potential proxy auth

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in DELETE /api/contact/whatsapp:", error);
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { sid } = requestBody;
    if (!sid) {
        return NextResponse.json({ detail: "Missing required field: sid" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${COMMUNICATION_URL}/whatsapp/delete`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ sid: sid }) 
            }
        );

        if (response.status === 204 || response.status === 200 && response.headers.get("content-length") === "0" ) { // Twilio might return 204 or empty 200
            return new NextResponse(null, { status: 204 });
        }
        
        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from communication service (whatsapp/delete):", e);
            if (response.ok) return { success: true, message: "Operation successful, but response was not JSON."};
            return { detail: "Invalid JSON response from communication service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Communication Service Error (whatsapp/delete - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to delete WhatsApp sender via communication service" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to communication service (whatsapp/delete):", error);
        return NextResponse.json({ detail: "Failed to connect to communication service", errorDetails: error.message }, { status: 503 });
    }
}