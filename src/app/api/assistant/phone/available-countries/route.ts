import { NextResponse } from 'next/server';
import { getCountryName, getCountryFlag } from '@/utils/team/country-utils';

export async function GET() {

    const envVarName = "TWILIO_AVAILABLE_PHONE_COUNTRIES";
    const envVar = process.env[envVarName];
    let countryDataList: { code: string; name: string; flag: string }[] = [];

    const fallbackData = { code: "US", name: getCountryName("US") || "United States", flag: getCountryFlag("US") };

    if (envVar && envVar.trim() !== "") {
        const codesFromEnv = envVar.split(',').map(code => code.trim().toUpperCase());
        const result = codesFromEnv
            .map(code => {
                if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
                    console.warn(`[API /api/assistant/phone/available-countries] Invalid country code format: "${code}"`);
                    return null;
                }
                const name = getCountryName(code);
                if (!name) {
                    console.warn(`[API /api/assistant/phone/available-countries] Could not get name for country code: "${code}"`);
                    return null;
                }
                return { code, name, flag: getCountryFlag(code) };
            })
            .filter(Boolean) as { code: string; name: string; flag: string }[];

        if (result.length > 0) {
            countryDataList = result;
        } else {
            console.log(`[API /api/assistant/phone/available-countries] Env var was set but resulted in an empty valid list. Using fallback.`);
            countryDataList = [fallbackData];
        }
    } else {
        console.log(`[API /api/assistant/phone/available-countries] ${envVarName} is not set or is empty. Using fallback.`);
        countryDataList = [fallbackData];
    }

    const sortedCountryDataList = countryDataList.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(sortedCountryDataList);
}