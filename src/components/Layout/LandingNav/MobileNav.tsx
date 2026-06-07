import React from 'react';
import NavbarLinks from './data';

interface MobileNavParams {
  children?: React.ReactNode;
  mobileChildren?: React.ReactNode;
  menuOpen: boolean;
}

const MobileNav = ({ children, menuOpen, mobileChildren }: MobileNavParams) => {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 top-0 z-10 h-screen w-screen max-w-full overflow-hidden bg-[rgba(var(--background-rgb),0.9)] backdrop-blur-[5px] transition-all ease-out lg:hidden"
      style={{
        transform: menuOpen ? 'translate(0px, 0px)' : 'translate(0px, -100vh)',
      }}
    >
      <div
        className="fixed left-0 right-0 top-0 h-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(var(--background-rgb),.9) 55%,transparent)',
        }}
      />
      <div className="flex h-full w-full flex-col gap-[16px] overflow-y-auto px-[20px] pb-[40px] pt-[80px]">
        {children && <div id="unify-mobile-navbar-end">{children}</div>}
        {mobileChildren
          ? mobileChildren
          : NavbarLinks.map((link, index) => (
              <div key={index} className="gap-[6px] pt-[10px]">
                <a
                  className="pb-1 font-semibold text-[#606264] dark:text-[rgba(255,255,255,0.8)]"
                  href={link.mainLink ? link.mainLink : '#'}
                >
                  {link.title}
                </a>
                {link.links
                  ? link.links.map((sublink, subindex) => (
                      <div
                        key={subindex}
                        className="rounded-lg pl-4 pt-2 transition-all hover:bg-[var(--surface-hover)]"
                      >
                        <a
                          href={sublink.href}
                          className="text-h1 text-bold w-full text-muted-foreground no-underline transition-all hover:text-foreground"
                        >
                          <p>{sublink.title}</p>
                        </a>
                        {sublink.title == 'Socials' ? (
                          <div className="w-full pb-1">{sublink.description}</div>
                        ) : (
                          <div className="w-full pb-1">
                            <a href={sublink.href} className="text-body no-underline">
                              <p>{'' + sublink.description}</p>
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  : null}
              </div>
            ))}
      </div>
    </div>
  );
};

export default MobileNav;
