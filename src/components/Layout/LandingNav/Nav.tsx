import React from "react";
import { Logo } from "@/utils/landingNav/consts";
import HamburgerMenu from "./HamburgerMenu";
import NavbarLinks from "./data";
import { FaGithub } from "react-icons/fa";
import { FaDiscord } from "react-icons/fa";

interface NavbParams {
    children?: React.ReactNode;
    // eslint-disable-next-line no-unused-vars
    onSelectionHover: (index: number) => () => void;
    menuOpen: boolean;
    // eslint-disable-next-line no-unused-vars
    setMenuOpen: (open: boolean) => void;
}

const Nav = ({ children, setMenuOpen: onOpenMenu, onSelectionHover, menuOpen }: NavbParams) => {
    return (
        <nav
            role="navigation"
            className="lg:w-fit flex items-center font-medium justify-between lg:justify-center gap-[50px] text-foreground"
        >
            <a href="https://unify.ai/" aria-current="page" aria-label="home" className='z-50 no-underline'>
                <Logo.dark className='hidden dark:block object-contain' width={78} loading="lazy" alt="Unify logo" />
                <Logo.light className='block dark:hidden object-contain' width={78} loading="lazy" alt="Unify logo" />
            </a>
            {NavbarLinks.map((link, index) => {
                return <a
                    key={index}
                    href={link.mainLink ? link.mainLink : "#"}
                    className="transition-all ease-out duration-250 hover:text-accent dark:hover:text-primary text-center hidden lg:block no-underline text-foreground"
                    onMouseEnter={onSelectionHover(index)}
                >
                    {link.title}
                </a>;
            })}
            {
                children &&
                <div className="hidden lg:block" id="unify-navbar-end">
                    <div className="flex flex-row gap-5 items-center">
                        {children}
                    </div>
                </div>
            }
            <HamburgerMenu
                open={menuOpen}
                onClick={() => onOpenMenu(!menuOpen)}
            />
        </nav>
    );
};

export default Nav;
