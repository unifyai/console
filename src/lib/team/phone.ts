import { AvailablePhoneCountry } from "@/types/team/assistant";
import { getCountryFlag, getCountryName } from "@/utils/team/country-utils";

// Function to fetch the available phone countries from the server
export async function fetchAvailablePhoneCountries(): Promise<AvailablePhoneCountry[]> {
    try {
        const response = await fetch('/api/assistant/phone/available-countries');
        if (!response.ok) {
            console.error("Failed to fetch available countries, status:", response.status);
            throw new Error('Failed to fetch available countries');
        }
        const data = await response.json();
        return data as AvailablePhoneCountry[];
    } catch (error) {
        console.error("Error fetching available countries:", error);
        // Fallback to US only in case of error
        const usName = getCountryName("US") || "United States";
        const usFlag = getCountryFlag("US");
        return [{ code: "US", name: usName, flag: usFlag }];
    }
}