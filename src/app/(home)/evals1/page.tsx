import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "./Main";
import {
    getLogFields,
    deleteLogFields,
    deleteLogs,
    deleteProject,
    getLogMetrics,
    getLogs,
    getProjects,
    createProject,
    renameProject,
    createInterface,
    updateInterface,
    getInterface
} from "../evals/actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";

const Evals1Page = async ({ searchParams }: { searchParams: { temporary?: string } }) => {
    // get user and api key
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.apiKey;

    // get server actions
    const projectsActions = {
        get: await getProjects(apiKey),
        create: await createProject(apiKey),
        rename: await renameProject(apiKey),
        delete: await deleteProject(apiKey)
    };

    const logsActions = {
        get: await getLogs(apiKey),
        getMetrics: await getLogMetrics(apiKey),
        delete: await deleteLogs(apiKey)
    }

    const fieldsActions = {
        get: await getLogFields(apiKey),
        delete: await deleteLogFields(apiKey)
    }

    const interfaceActions = {
        create: await createInterface(apiKey),
        update: await updateInterface(apiKey),
        get: await getInterface(apiKey)
    }

    return (
        <Suspense fallback={<SkeletonLoader />}>
            <Main
                temporary={Boolean(searchParams.temporary)}
                projectsActions={projectsActions}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                interfaceActions={interfaceActions}
            />
        </Suspense>
    );
};

export default Evals1Page;
