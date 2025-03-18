"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import HallowButton from "./hallowButton";
import loginImage1 from "@/public/icons/login-1.png";
import loginImage2 from "@/public/icons/login-2.png";
import loginImage3 from "@/public/icons/login-3.png";
import GoogleIcon from "@/public/icons/google-icon.png";
import GithubIcon from "@/public/icons/github-icon.png";

interface LoginProps {
    // eslint-disable-next-line no-unused-vars
    onLogin: (provider: "email" | "google" | "github", email?: string) => () => void;
    error?: string;
}

const LoginFragment = ({ onLogin: handleLogin, error }: LoginProps) => {
    const [email, setEmail] = useState<string>("");

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleLogin("email", email)();
    };

    return (
        <div
            className="flex gap-16 flex-wrap"
        >
            <div className="flex flex-1 flex-col gap-[40px]">
                <h1
                    className="text-5xl text-transparent bg-clip-text bg-gradient-to-br from-[#0A0C13] to-[#606264]"
                >
                    <span>
                        {"Build AI "}
                    </span>
                    <span className="font-semibold">
                        {"Your Way"}
                    </span>
                </h1>
                <div className="flex flex-col gap-3">
                    <div
                        className="text-red-500"
                    >
                        {error}
                    </div>
                    <HallowButton
                        onClick={handleLogin("google")}
                    >
                        <div className="flex gap-2 justify-center items-center">
                            <Image src={GoogleIcon} alt="Google" height={20} width={20} />
                            Continue with Google
                        </div>
                    </HallowButton>
                    <HallowButton
                        onClick={handleLogin("github")}
                    >
                        <div className="flex gap-2 justify-center items-center">
                            <Image src={GithubIcon} alt="Github" height={20} width={20} />
                            Continue with Github
                        </div>
                    </HallowButton>
                    <div
                        className="text-branding-grey text-sm"
                    >
                        {"By signing up you agree to our "}
                        <a href="https://unify.ai/privacy-policy" className="font-semibold">Privacy Policy</a>
                        {" and "}
                        <a href="https://unify.ai/terms-of-service" className="font-semibold">Terms Of Service</a>
                        {". You may also receive communication on product updates and events, which you can edit in your profile."}
                    </div>
                </div>
            </div>
            <div
                className="bg-[#DADADA] w-[1px] lg:block hidden"
            />
            <div className="flex-col lg:flex-[2] gap-[60px] flex text-xl">
                <div
                    className="text-branding-grey"
                >
                    Your Unify account lets you:
                </div>
                <div className="flex flex-col gap-[40px]">
                    <div className="flex gap-[30px] font-medium">
                        <Image src={loginImage2} alt="Convert code" className="h-fit" />
                        <p>
                            Deploy through any endpoint with a single API.
                        </p>
                    </div>
                    <div className="flex gap-[30px] font-medium">
                        <Image src={loginImage1} alt="Convert code" className="h-fit" />
                        <p>
                            Iterate on your workflows with customized interfaces.
                        </p>
                    </div>
                    <div className="flex gap-[30px] font-medium">
                        <Image src={loginImage3} alt="Convert code" className="h-fit" />
                        <p>
                            Monitor your applications with flexible dashboards.
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    {"Got any questions? Contact us at "}
                    <a
                        href="mailto:hello@unify.ai"
                        className="font-semibold text-transparent bg-clip-text bg-gradient-to-br from-[#0A0C13] to-[#00B828]"
                    >
                        hello@unify.ai
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LoginFragment;
