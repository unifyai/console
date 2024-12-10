"use client";

import { useState } from "react";
import SinglePaneBody from "../Common/Body/SinglePaneBody";
import AccountBalance from "./Balance";
import AutomaticRefill from "./Refill";

const Main = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const overlay = (isVisible: boolean) => isVisible && <div className="fixed inset-0 bg-background opacity-50 z-40"></div>
    const body =    <div className={`relative ${isSidebarOpen ? "pointer-events-none" : ""}`}>
                        {overlay(isSidebarOpen)}
                        <div className="w-full flex flex-col gap-5">
                            <AccountBalance setIsSidebarOpen={setIsSidebarOpen}/>
                            <AutomaticRefill/>
                        </div>
                    </div>
    return (
    <SinglePaneBody 
        isPending={false}
        body={
            <div className="text-lg font-normal flex flex-col gap-5 p-5 w-fit h-fit">
                <div className="flex flex-col gap-2 w-full">
                    <h1 className="text-4xl font-bold text-foreground">Billing</h1>
                    <p className="text-muted-foreground">Manage your credits balance and payment preferences.</p>
                </div>
                {body}
            </div>
        }
        />
    );
};

export default Main;
