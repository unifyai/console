import Main from "@/components/Chat/Main";
import { getCurrentUser } from "@/lib/user/user";
import { providers } from "@/constants/endpoints";
import { listEndpoints } from "@/lib/endpoints/endpoints";

const ChatPage = async () => {

    // get user and api key
    const user = await getCurrentUser();
    const apiKey = user!.apiKey;

    // get endpoints
    const endpointsList: string[] = await listEndpoints(
        apiKey,
        undefined,
        undefined
    );

    const endpoints = endpointsList.map((endpoint) => {
        const code = endpoint.split("@").at(0)!;
        const provider = endpoint.split("@").at(-1)!;
        const image = providers[provider as keyof typeof providers || "custom"];
        return {
            code: code,
            provider: provider,
            providerImage: image
        };
    });

    return <div className="w-full h-full p-1 overflow-auto">
        <Main endpoints={endpoints} apiKey={apiKey} />
    </div>;
};

export default ChatPage;
