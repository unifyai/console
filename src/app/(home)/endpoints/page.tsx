import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Pages/Endpoints/Main";
import { deleteCustomEndpoint, renameCustomEndpoint, listCustomEndpoints, createCustomEndpoint } from "./actions";
import { listCustomKeys } from "../keys/actions";
import { FileProps } from "@/types/common";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";

const CustomEndpointsPage = async () => {
    // get user and api key
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.api_key;

    // get custom endpoints
    const getEndpoints = await listCustomEndpoints(apiKey);
    const customEndpointsList = await getEndpoints();
    const customEndpoints: FileProps[] = customEndpointsList.map((endpoint) => ({ path: endpoint.name, type: "file", data: { ...endpoint } }));

    // get custom keys
    const getKeys = await listCustomKeys(apiKey);
    const customKeysList = await getKeys()
    const customKeys: FileProps[] = customKeysList.map((key) => ({ path: key.name, type: "file", data: { ...key } }));

    // get server actions
    const customEndpointActions = {
        rename: await renameCustomEndpoint(apiKey),
        delete: await deleteCustomEndpoint(apiKey),
        create: await createCustomEndpoint(apiKey),
    };

    return (
        <div className="w-full h-full p-1 overflow-auto">
            <Suspense fallback={<SkeletonLoader />}>
                <Main customEndpoints={customEndpoints} customKeys={customKeys} customEndpointActions={customEndpointActions} />
            </Suspense>
        </div>
    );
};

export default CustomEndpointsPage;
