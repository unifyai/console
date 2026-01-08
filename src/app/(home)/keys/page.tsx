import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Pages/Keys/Main";
import { listProviders, createCustomKey, deleteCustomKey, renameCustomKey, listCustomKeys } from "./actions";
import { FileProps } from "@/types/common";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";

const CustomKeysPage = async () => {
    // get user and api key
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.apiKey;
    const onPrem = process.env.ON_PREM;

    // get custom keys
    const getKeys = await listCustomKeys(apiKey);
    const customKeysList = await getKeys();
    const customKeys: FileProps[] = customKeysList.map((key) => ({ path: key.name, type: "file", data: { ...key } }));

    // get default providers
    const getProviders = await listProviders(apiKey);
    const providers = await getProviders();

    // get server actions
    const customKeyActions = {
        rename: await renameCustomKey(apiKey),
        delete: await deleteCustomKey(apiKey),
        create: await createCustomKey(apiKey)
    };

    return (
        <div className="w-full h-full p-1 overflow-auto">
            <Suspense fallback={<SkeletonLoader />}>
                <Main apiKey={apiKey} onPrem={onPrem} providers={providers} customKeys={customKeys} customKeyActions={customKeyActions} />
            </Suspense>
        </div>
    );
};

export default CustomKeysPage;
