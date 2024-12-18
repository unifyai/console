import React, { useEffect, useState } from "react";
import { Logo } from "@/utils/landingNav/consts";
import NavbarLinks from "./data";
import HamburgerMenu from "./HamburgerMenu";
import { getSession } from "@/lib/user/user";

interface UserType {
  name: string;
  image: string;
}

interface NavbParams {
  children?: React.ReactNode;
  onSelectionHover: (index: number) => () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const Nav = ({ children, setMenuOpen, onSelectionHover, menuOpen }: NavbParams) => {
  const [user, setUser] = useState<UserType | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const sessionData = await getSession();
      const userName = sessionData?.user?.name || "";
      const imageUrl = sessionData?.user?.image || "";
      setUser({ name: userName, image: imageUrl });
    }
    fetchUser();
  }, []);

  return (
    <nav
      role="navigation"
      className="flex items-center justify-between w-full p-4 md:justify-center font-medium text-foreground"
    >
      {/* Mobile: Hamburger + Logo */}
      <div className="flex items-center gap-2 lg:hidden">
        <HamburgerMenu open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
        <a href="https://unify.ai/" aria-label="Unify home" className="no-underline">
          <Logo.dark className="hidden dark:block object-contain" width={78} loading="lazy" alt="Unify logo" />
          <Logo.light className="block dark:hidden object-contain" width={78} loading="lazy" alt="Unify logo" />
        </a>
      </div>

      {/* Desktop: Logo */}
      <div className="hidden lg:flex items-center flex-shrink-0 mr-auto">
        <a href="https://unify.ai/" aria-label="Unify home" className="no-underline">
          <Logo.dark className="hidden dark:block object-contain" width={78} loading="lazy" alt="Unify logo" />
          <Logo.light className="block dark:hidden object-contain" width={78} loading="lazy" alt="Unify logo" />
        </a>
      </div>

      {/* Navigation Links (Desktop only) */}
      <div className="hidden lg:flex justify-center flex-grow mx-8 gap-6">
        {NavbarLinks.map((link, index) => (
          <a
            key={index}
            href={link.mainLink ? link.mainLink : "#"}
            className="transition-all ease-out duration-250 hover:text-accent dark:hover:text-primary text-center no-underline text-foreground"
          >
            {link.title}
          </a>
        ))}
      </div>

      {/* Right side user status */}
      <div className="flex items-center gap-2">
        {user?.name ? (
          <a href="/profile" className="no-underline flex items-center gap-2">
            {user.image && (
              <img
                src={user.image}
                alt={user.name || "User avatar"}
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span className="hidden sm:inline">{user.name}</span>
          </a>
        ) : (
          <a
          href="/login"
          className="transition-all ease-out duration-250 hover:text-accent dark:hover:text-primary text-center no-underline text-foreground"
          >
            Sign in
          </a>
        )}
      </div>
    </nav>
  );
};

export default Nav;