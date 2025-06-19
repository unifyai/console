// Helper to convert country code to flag emoji
export function getCountryFlag(countryCode: string): string {
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
export function getCountryName(countryCode: string, locale: string = 'en'): string | null {
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
