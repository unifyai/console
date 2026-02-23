'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Nav from './Nav';
import Menus from './Menus';
import MobileNav from './MobileNav';
import NavbarLinks from './data';

interface NavbarParams {
  menuAlwaysOpaque?: boolean;
  children?: React.ReactNode;
  mobileChildren?: React.ReactNode;
}

const NavBar = ({ menuAlwaysOpaque = false, children, mobileChildren }: NavbarParams) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const onScroll = useCallback(() => {
    const { scrollY } = window;
    setScrolled(scrollY > 0 || menuAlwaysOpaque);
  }, [menuAlwaysOpaque]);

  useEffect(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [onScroll]);

  const onMouseEnter = (index: number) => () => {
    setSelected(index);
  };

  const onMouseLeave = () => {
    setSelected(null);
  };

  return (
    <header
      role="banner"
      className="text-body fixed left-0 right-0 top-0 z-50 w-full px-[16px] pb-[13px] pt-[13px] transition-all will-change-[transform,background] lg:px-14"
      style={
        (scrolled && !menuOpen) ||
        (selected !== null && NavbarLinks.at(selected)!.title != 'Pricing') // Remove dropdown from menus that don't have sublinks
          ? {
              backgroundColor: 'rgba(var(--background-rgb), 0.9)',
              boxShadow: '0 0 20px rgba(0,0,0,.1)',
              backdropFilter: 'blur(5px)',
            }
          : {
              backgroundColor: 'transparent',
            }
      }
    >
      <div onMouseLeave={onMouseLeave} className="lg:mx-auto lg:w-fit">
        {/* TODO: Refactor this to be more reusable */}
        <Nav onSelectionHover={onMouseEnter} menuOpen={menuOpen} setMenuOpen={setMenuOpen}>
          {children}
        </Nav>
        <Menus selected={selected} />
        <MobileNav menuOpen={menuOpen} mobileChildren={mobileChildren}>
          {children}
        </MobileNav>
      </div>
    </header>
  );
};

export default NavBar;
