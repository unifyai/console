"use server";

import { ResponseProps } from "@/types/common";
import { CustomKey } from "@/types/custom";

export const listProviders = (apiKey: string) => {
    return async () : Promise<string[]> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/providers`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    }
};

export const listCustomKeys = async (apiKey: string) => {
    return async (): Promise<CustomKey[]> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customKeys/list`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

export const createCustomKey = async (apiKey: string) => {
    return async (name: string, value: string) : Promise<ResponseProps> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customKeys?name=${name}&value=${value}`,
            { method: "POST", headers: { apiKey: apiKey } }
        );
        return await response.json();
    }
};

export const deleteCustomKey = async (apiKey: string) => {
    return async (name: string) : Promise<ResponseProps>  => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customKeys?name=${name}`,
            { method: "DELETE", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

export const renameCustomKey = async (apiKey: string) => {
    return async (name: string, newName: string) : Promise<ResponseProps> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customKeys/rename?name=${name}newName=${newName}`,
            { method: "POST", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};
