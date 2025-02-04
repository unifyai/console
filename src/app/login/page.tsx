"use client";

import { LayoutGroup, motion } from "framer-motion";
import { signIn, useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import LoginFragment from "./login";
import { useState } from "react";
import CheckElement from "./check";
import Back from "@/public/icons/back.svg";
import UnifyLogo from "@/components/Common/Misc/UnifyLogo";
import AnimatedTabs from "@/components/Navigation/AnimatedTabs";
import LoadingElement from "@/components/Common/Loaders/LoadingElement";
import { useTheme } from "next-themes";


const ERRORS: Record<string, string> = {
    Signin: "Try signing with a different account.",
    OAuthSignin: "Try signing with a different account.",
    OAuthCallback: "Try signing with a different account.",
    OAuthCreateAccount: "Try signing with a different account.",
    EmailCreateAccount: "Try signing with a different account.",
    Callback: "Try signing with a different account.",
    OAuthAccountNotLinked:
        "To confirm your identity, sign in with the same account you used originally.",
    EmailSignin: "Check your email address.",
    CredentialsSignin:
        "Sign in failed. Check the details you provided are correct.",
    Verification: "Error occured during verification.",
    default: "Unable to sign in.",
};

const Login = () => {
    const session = useSession();

    if (session.data) {
        redirect("/interfaces");
    }

    const searchParams = useSearchParams();
    const callbackUrl = searchParams?.get("callbackUrl");
    const searchError = searchParams?.get("error");
    const searchErrorMessage = searchError ? ERRORS[searchError] : undefined;
    const [tab, setTab] = useState<"login" | "loading" | "check">("login");
    const [error, setError] = useState<string | undefined>(searchErrorMessage);
    const { resolvedTheme } = useTheme();

    const handleLogin = (provider: "email" | "google" | "github", email?: string) => async () => {
        setTab("loading");
        let callback : URL;
        if (callbackUrl?.startsWith("http")) {
            callback = new URL(callbackUrl);
        }
        else {
            callback = new URL(callbackUrl ?? "/", document.location.href);
        }
        callback.searchParams.delete("error");
        if (provider === "email") {
            const result = await signIn("email", { email, redirect: false, callbackUrl: callback.toString() });

            if (!result || result.error || !result.ok) {
                setTab("login");
                setError(ERRORS[result?.error ?? "default"]);
                return;
            }

            if (result.ok) {
                setTab("check");
                return;
            }
        }
        await signIn(provider, { callbackUrl: callback.toString() });
    };

    return (<div className="fixed top-0 left-0 w-screen h-screen flex justify-center items-center">
        <LayoutGroup>
            <motion.div
                initial={{ y: "100vh" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", bounce: 0.1 }}
                className="border-1 border-[#F5F5F5] mt-20 p-6 rounded-3xl backdrop-blur-lg z-[200]"
            >
                <div
                    className="bg-background p-8 md:p-24 w-screen xl:w-[1280px] rounded-lg xl:drop-shadow-[0px_12px_100px_rgba(0,184,40,0.18)] max-h-screen overflow-y-auto overflow-x-hidden"
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col gap-9"
                    >
                        <div
                            className="flex justify-between"
                        >
                            <UnifyLogo theme={resolvedTheme}/>
                            <a
                                href="https://unify.ai"
                            >
                                <Back />
                            </a>
                        </div>
                        <div className="lg:container flex justify-center">
                            <AnimatedTabs selected={tab}>
                                <LoginFragment
                                    onLogin={handleLogin}
                                    error={error}
                                    key="login"
                                />
                                <LoadingElement key="loading" />
                                <CheckElement key="check" />
                            </AnimatedTabs>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </LayoutGroup>
    </div>);
};

export default Login;
