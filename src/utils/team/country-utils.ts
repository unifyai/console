// Helper to convert country code to flag emoji
function getFlagEmoji(countryCode: string): string {
    // Ensure countryCode is uppercase and 2 letters
    const code = countryCode.toUpperCase();
    if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
        return '🏳️'; // Default flag for invalid codes
    }
    // Regional Indicator Symbol Letters for A-Z start at 0x1F1E6
    // charCodeAt(0) gives UTF-16 code unit. For A-Z, this is 65-90.
    const firstLetter = String.fromCodePoint(code.charCodeAt(0) - 65 + 0x1F1E6);
    const secondLetter = String.fromCodePoint(code.charCodeAt(1) - 65 + 0x1F1E6);
    return firstLetter + secondLetter;
}

// Function to get country name using Intl.DisplayNames
function getCountryName(countryCode: string, locale: string = 'en'): string | null {
    try {
        const displayName = new Intl.DisplayNames([locale], { type: 'region' });
        return displayName.of(countryCode.toUpperCase()) || null;
    } catch (e) {
        // This can happen if the countryCode is invalid or not recognized by Intl.DisplayNames
        // For example, 'PR' (Puerto Rico) might not be recognized as a "region" by all Intl implementations
        // as it's a territory. In such cases, we might need a manual fallback for specific codes.
        if (countryCode.toUpperCase() === 'PR') return 'Puerto Rico'; // Manual fallback for common cases
        
        console.warn(`[country-utils] Could not get display name for country code "${countryCode}" using Intl.DisplayNames:`, e);
        return null;
    }
}


// Function to build availablePhoneCountries from environment variable
function buildAvailablePhoneCountriesList(): { code: string; name: string; flag: string }[] {
    const envVar = process.env.TWILIO_AVAILABLE_PHONE_COUNTRIES;
    let countryList: { code: string; name: string; flag: string }[];

    const fallbackData = { code: "US", name: getCountryName("US") || "United States", flag: getFlagEmoji("US") };

    if (envVar && envVar.trim() !== "") {
        const codesFromEnv = envVar.split(',').map(code => code.trim().toUpperCase());
        const result = codesFromEnv
            .map(code => {
                if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
                    console.warn(`[country-utils] Invalid country code format "${code}" from TWILIO_AVAILABLE_PHONE_COUNTRIES. Skipping.`);
                    return null;
                }
                const name = getCountryName(code);
                if (!name) {
                    console.warn(`[country-utils] Country code "${code}" from TWILIO_AVAILABLE_PHONE_COUNTRIES not recognized or name not found. Skipping.`);
                    return null;
                }
                return { code, name, flag: getFlagEmoji(code) };
            })
            .filter(Boolean) as { code: string; name: string; flag: string }[];

        if (result.length > 0) {
            countryList = result;
        } else {
            console.warn("[country-utils] TWILIO_AVAILABLE_PHONE_COUNTRIES was set but no valid country codes were resolved. Falling back to default (US only).");
            countryList = [fallbackData];
        }
    } else {
        console.warn("[country-utils] TWILIO_AVAILABLE_PHONE_COUNTRIES not set or empty. Falling back to default (US only).");
        countryList = [fallbackData];
    }
    
    // Sort the final list alphabetically by country name for consistent display in dropdowns
    return countryList.sort((a, b) => a.name.localeCompare(b.name));
}

export const availablePhoneCountries = buildAvailablePhoneCountriesList();

export const getCountryFlag = (countryCode: string | undefined): string => {
    if (!countryCode) return "🏳️";
    const country = availablePhoneCountries.find(c => c.code === countryCode.toUpperCase());
    // If not in the dynamic list (e.g. an old assistant with a country no longer in env var),
    // still try to generate its flag directly.
    return country ? country.flag : getFlagEmoji(countryCode);
};

export const getCountryNameByCode = (countryCode: string | undefined): string => {
    if (!countryCode) return "N/A";
    const country = availablePhoneCountries.find(c => c.code === countryCode.toUpperCase());
    // If not in the dynamic list, try to get its name directly.
    return country ? country.name : (getCountryName(countryCode) || countryCode);
};