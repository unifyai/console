import React from 'react';
import { Logo } from '@/utils/landingNav/consts';
import HamburgerMenu from './HamburgerMenu';
import NavbarLinks from './data';
import { FaGithub } from 'react-icons/fa';
import { FaDiscord } from 'react-icons/fa';

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
      className="flex items-center justify-between gap-[50px] font-medium text-foreground lg:w-fit lg:justify-center"
    >
      <a
        href="https://unify.ai/"
        aria-current="page"
        aria-label="home"
        className="z-50 no-underline"
      >
        <Logo.dark
          className="hidden object-contain dark:block"
          width={78}
          loading="lazy"
          alt="Unify logo"
        />
        <Logo.light
          className="block object-contain dark:hidden"
          width={78}
          loading="lazy"
          alt="Unify logo"
        />
      </a>
      {NavbarLinks.map((link, index) => {
        return (
          <a
            key={index}
            href={link.mainLink ? link.mainLink : '#'}
            className="duration-250 hidden text-center text-foreground no-underline transition-all ease-out hover:text-accent dark:hover:text-primary lg:block"
            onMouseEnter={onSelectionHover(index)}
          >
            {link.title}
          </a>
        );
      })}
      {children && (
        <div className="hidden lg:block" id="unify-navbar-end">
          <div className="flex flex-row items-center gap-5">{children}</div>
        </div>
      )}
      <HamburgerMenu open={menuOpen} onClick={() => onOpenMenu(!menuOpen)} />
    </nav>
  );
};

export default Nav;
