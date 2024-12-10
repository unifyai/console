import { NextUIProvider } from "../../lib/nextui";
import Navbar from "./NavBar";
import React from "react";
import Footer from "./Footer";
import { Inter } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@/styles/globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";

config.autoAddCss = false;

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
});

interface ScaffoldProps {
    children: React.ReactNode;
    navbar?: boolean | React.ReactNode;
    footer?: boolean;
    navbarEnd?: React.ReactNode;
    className?: string;
    fullScreen?: boolean;
    container?: boolean;
}

const Scaffold = ({ children, navbarEnd, navbar = true, footer = true, className, fullScreen = false, container = true }: ScaffoldProps) => {
    return (<html lang="en" className={fullScreen ? "h-full" : undefined}>
        <body className={`${inter.className}${fullScreen ? " h-full" : ""}`}>
            <NextUIProvider className={fullScreen ? "h-full" : "min-h-screen flex flex-col"}>
                {navbar === true &&
                    <Navbar>
                        {navbarEnd}
                    </Navbar>
                    || navbar === false && null
                    || navbar
                }
                <main className={`${container ? "container " : ""}pt-[44px] px-8 lg:px-0 pb-8 ${fullScreen ? "h-full" : "flex-grow"}${className ? " " + className : ""}`}>
                    {children}
                </main>
                {footer &&
                    <Footer />
                }
            </NextUIProvider>
        </body>
    </html>);
};

export default Scaffold;
