import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";

export async function GET(req: NextApiRequest, res: NextApiResponse) {
    const session = await getSession({ req });
    res.setHeader("Access-Control-Allow-Origin", "https://unify.ai");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (session) {
        // User is authenticated
        res.status(200).json({ session });
    } else {
        // User is not authenticated
        res.status(401).json({ error: "Unauthorized" });
    }
}
