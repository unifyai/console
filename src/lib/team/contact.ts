import { ResponseProps } from "@/types/common";

export const createAssistantEmail = async (apiKey: string) => {
    return async (firstName: string, lastName: string): Promise<{ email: string; user?: any; } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, { // Path updated to root of email contact
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, lastName })
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to create email: ${response.statusText}` };
            }
            if (data.email) {
                return data as { email: string; user?: any; };
            }
            return { detail: "Email creation succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error creating email." };
        }
    };
};

export const deleteAssistantEmail = async (apiKey: string) => {
    return async (primaryEmail: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, { // Path updated to root of email contact
                method: "DELETE",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ primaryEmail })
            });
            // DELETE might return 204 No Content, or a JSON body.
            if (response.status === 204) {
                return { info: `Email ${primaryEmail} deleted successfully.` };
            }
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to delete email: ${response.statusText}` };
            }
            return { info: data.info || data.message || `Email ${primaryEmail} deleted successfully.` };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error deleting email." };
        }
    };
};

export const createAssistantPhoneNumber = async (apiKey: string) => {
    return async (): Promise<{ phoneNumber: string } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/phone`, { // Path updated to root of phone contact
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" }
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to create phone number: ${response.statusText}` };
            }
            if (data.phoneNumber) {
                return data as { phoneNumber: string };
            }
            return { detail: "Phone number creation succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error creating phone number." };
        }
    };
};

export const deleteAssistantPhoneNumber = async (apiKey: string) => {
    return async (phoneNumber: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/phone`, { // Path updated to root of phone contact
                method: "DELETE",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber })
            });
            if (response.status === 204) {
                return { info: `Phone number ${phoneNumber} deleted successfully.` };
            }
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to delete phone number: ${response.statusText}` };
            }
            return { info: data.info || data.message || `Phone number ${phoneNumber} deleted successfully.` };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error deleting phone number." };
        }
    };
};