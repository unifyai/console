import { NextResponse } from 'next/server';
import { getCountryName, getCountryFlag } from '@/utils/team/country-utils';

export async function GET() {

    const envVar = process.env.TWILIO_AVAILABLE_PHONE_COUNTRIES;
    let countryDataList: { code: string; name: string; flag: string }[] = [];

    const fallbackData = { code: "US", name: getCountryName("US") || "United States", flag: getCountryFlag("US") };

    if (envVar && envVar.trim() !== "") {
        const codesFromEnv = envVar.split(',').map(code => code.trim().toUpperCase());
        const result = codesFromEnv
            .map(code => {
                if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
                    // Log on server if needed, but don't expose detailed warnings to client
                    return null; 
                }
                const name = getCountryName(code);
                if (!name) {
                    return null;
                }
                return { code, name, flag: getCountryFlag(code) };
            })
            .filter(Boolean) as { code: string; name: string; flag: string }[];

        if (result.length > 0) {
            countryDataList = result;
        } else {
            // Fallback if env var is set but results in an empty valid list
            countryDataList = [fallbackData];
        }
    } else {
        // Fallback if env var is not set or is empty: US only
        countryDataList = [fallbackData];
    }
    
    // Sort the final list alphabetically by country name
    const sortedCountryDataList = countryDataList.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(sortedCountryDataList);
}