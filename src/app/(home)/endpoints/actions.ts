"use server";

import { ResponseProps } from "@/types/common";
import { CustomEndpoint } from "@/types/custom";

export const listCustomEndpoints = async (apiKey: string) => {
    return async () : Promise<CustomEndpoint[]> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customEndpoints/list`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    }
};

export const createCustomEndpoint = async (apiKey: string) => {
    return async (name: string, url: string, keyName: string, modelArg?: string) : Promise<ResponseProps> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customEndpoints?name=${name}&url=${url}&keyName=${keyName}` + (modelArg ? `&modelArg=${modelArg}` : ""),
            { method: "POST", headers: { apiKey: apiKey } }
        );
        return await response.json();
    }
};

export const deleteCustomEndpoint = async (apiKey: string) => {
    return async (name: string) : Promise<ResponseProps>  => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customEndpoints?name=${name}`,
            { method: "DELETE", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

export const renameCustomEndpoint = async (apiKey: string) => {
    return async (name: string, newName: string) : Promise<ResponseProps> => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/customEndpoints/rename?name=${name}&newName=${newName}`,
            { method: "RENAME", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};