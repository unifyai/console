import React from "react";
import NavbarLinks from "./data";

interface MobileNavParams {
    children?: React.ReactNode;
    mobileChildren?: React.ReactNode;
    menuOpen: boolean;
}

const MobileNav = ({ children, menuOpen, mobileChildren }: MobileNavParams) => {
    return (
        <div
            className='lg:hidden fixed top-0 left-0 right-0 bottom-0 overflow-hidden h-screen w-screen max-w-full bg-[rgba(var(--background-rgb),0.9)] transition-all ease-out z-10 backdrop-blur-[5px]'
            style={{
                transform: menuOpen ? "translate(0px, 0px)" : "translate(0px, -100vh)",
            }}
        >
            <div
                className="fixed top-0 left-0 right-0 h-20"
                style={{
                    backgroundImage: "linear-gradient(rgba(var(--background-rgb),.9) 55%,transparent)"
                }}
            />
            <div
                className='flex flex-col gap-[16px] pt-[80px] pb-[40px] px-[20px] overflow-y-auto h-full w-full'
            >
                {
                    children &&
                    <div id="unify-mobile-navbar-end">
                        {children}
                    </div>
                }
                {
                    mobileChildren ?
                        mobileChildren
                        :
                        NavbarLinks.map((link, index) => 
                        <div key={index} className="gap-[6px] pt-[10px]">
                            <a
                                className="font-semibold pb-1 text-[#606264] dark:text-[rgba(255,255,255,0.8)]"
                                href={link.mainLink ? link.mainLink : "#"}
                            >
                                {link.title}
                            </a>
                            {link.links
                                ? link.links.map((sublink, subindex) =>
                                    <div key={subindex} className="hover:bg-gray-100 transition-all pt-2 pl-4 rounded-lg">
                                        <a
                                            href={sublink.href}
                                            className="text-[#51515e] hover:text-[#0a0c13] dark:text-white/90 dark:hover:text-white transition-all text-xl font-bold no-underline w-full"
                                        >
                                            <p>{sublink.title}</p>
                                        </a>
                                        {
                                            sublink.title == "Socials" ?
                                                (<div className="pb-1 w-full">{sublink.description}</div>) :
                                                (<div className="pb-1 w-full">
                                                    <a href={sublink.href} className="no-underline text-sm">
                                                        <p>{"" + sublink.description}</p>
                                                    </a>
                                                </div>)
                                        }
                                    </div>
                                )
                                : null
                            }
                        </div>
                        )
                }
            </div>
        </div>
    );
};

export default MobileNav;
