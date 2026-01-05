import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const COMMUNICATION_URL = process.env.COMMUNICATION_URL;
const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY

export async function POST(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in POST /api/contact/email:", error);
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { email } = requestBody;
    if (!email) {
        return NextResponse.json({ detail: "Missing required field: email" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ detail: "Invalid email format provided." }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${COMMUNICATION_URL}/email/create`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email_address: email })
            }
        );

        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from communication service (email/create):", e);
            return { detail: "Invalid JSON response from communication service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Communication Service Error (email/create - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to create email via communication service" }, { status: response.status });
        }
        
        if (responseData.success && responseData.user && responseData.user.primaryEmail) {
            return NextResponse.json({ email: responseData.user.primaryEmail, user: responseData.user }, { status: 201 });
        } else if (responseData.email) {
             return NextResponse.json({ email: responseData.email }, { status: 201 });
        }
        else {
            console.error("Communication service (email/create) did not return expected email data:", responseData);
            return NextResponse.json({ detail: "Failed to create email, unexpected response from service." }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Error proxying to communication service (email/create):", error);
        return NextResponse.json({ detail: "Failed to connect to communication service", errorDetails: error.message }, { status: 503 });
    }
}

export async function DELETE(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in DELETE /api/contact/email:", error);
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { primaryEmail } = requestBody;
    if (!primaryEmail) {
        return NextResponse.json({ detail: "Missing required field: primaryEmail" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${COMMUNICATION_URL}/email/delete`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ primary_email: primaryEmail })
            }
        );

        // If the response is 204 No Content, there might not be a JSON body
        if (response.status === 204) {
            return new NextResponse(null, { status: 204 });
        }
        
        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from communication service (email/delete):", e);
            // If parsing fails but status is OK-ish, it might be an unexpected success response or an error without JSON
            if (response.ok) return { success: true, message: "Operation successful, but response was not JSON."};
            return { detail: "Invalid JSON response from communication service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Communication Service Error (email/delete - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to delete email via communication service" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to communication service (email/delete):", error);
        return NextResponse.json({ detail: "Failed to connect to communication service", errorDetails: error.message }, { status: 503 });
    }
}


export async function GET(request: NextRequest) {

    const apiKey = request.headers.get("apiKey");

    try {
        const adminEmailsResponse = await fetch(
            `${ORCHESTRA_BASE_URL}/admin/assistant/emails`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "accept": "application/json",
                }
            }
        );

        const responseData = await adminEmailsResponse.json().catch(e => {
            console.error("Failed to parse JSON response from admin backend (admin/assistant/emails):", e);
            return { detail: "Invalid JSON response from admin email listing service", status: adminEmailsResponse.status };
        });

        if (!adminEmailsResponse.ok) {
             console.error(`Admin Backend Error (admin/assistant/emails - ${adminEmailsResponse.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to fetch assistant emails from admin service" }, { status: adminEmailsResponse.status });
        }
        
        // The backend /admin/assistant/emails returns InfoResponse[List[str]]
        // So responseData should be { info: ["email1", "email2"] }
        if (responseData.info && Array.isArray(responseData.info)) {
            return NextResponse.json({ emails: responseData.info }, { status: 200 });
        } else {
            console.error("Admin backend (admin/assistant/emails) did not return expected 'info' array:", responseData);
            return NextResponse.json({ detail: "Unexpected response format from admin email listing service." }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Error proxying to admin backend (admin/assistant/emails):", error);
        return NextResponse.json({ detail: "Failed to connect to admin email listing service", errorDetails: error.message }, { status: 503 });
    }
}