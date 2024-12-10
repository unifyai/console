import axios from "axios";

export const OrchestraAdminClient = axios.create({
    baseURL: process.env.ORCHESTRA_URL + "/v0/admin",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ORCHESTRA_ADMIN_KEY}`
        }
    });

export async function getOrchestraUserClient(userAPIKey: string) {
    return axios.create({
        baseURL: process.env.ORCHESTRA_URL + "/v0",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userAPIKey}`
            }
        });
}