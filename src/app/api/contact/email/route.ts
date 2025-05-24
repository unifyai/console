import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.COMMUNICATION_URL;

export async function POST(request: NextRequest) {

    const apiKey = request.headers.get("apiKey");

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in POST /api/contact/email/create:", error);
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { firstName, lastName } = requestBody;
    if (!firstName || !lastName) {
        return NextResponse.json({ detail: "Missing required fields: firstName, lastName" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${baseUrl}/email/create`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ first_name: firstName, last_name: lastName })
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
        } else {
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
            `${baseUrl}/email/delete`, // Backend endpoint path
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