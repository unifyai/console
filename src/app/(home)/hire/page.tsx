import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Hire/Main";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { User } from "@/types/user";

const HirePage = async ({ searchParams }: { searchParams: { } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }

    return (
        <div className="w-full h-full">
            <Suspense fallback={<SkeletonLoader />}>
                <Main/>
            </Suspense>
        </div>
    );
};

export default HirePage;
