/* eslint-disable @next/next/no-img-element */
import React from 'react';

interface NavbarMenu {
  title: string;
  mainLink?: string;
  subtitle?: string;
  links?: {
    title: string;
    href?: string;
    description: React.ReactElement | string;
  }[];
}

const NavbarLinks: Array<NavbarMenu> = [
  {
    title: 'Docs',
    mainLink: 'https://unify.ai/docs/',
  },
  {
    title: 'Github',
    mainLink: 'https://github.com/unifyai/unify',
  },
  {
    title: 'Pricing',
    mainLink: 'https://unify.ai/pricing',
  },
];

export default NavbarLinks;
