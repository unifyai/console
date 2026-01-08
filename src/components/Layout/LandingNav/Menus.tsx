import { AnimateHeight } from './AnimateHeight';
import NavbarLinks from './data';

interface MenusParams {
  selected: number | null;
}

const Menus = ({ selected }: MenusParams) => {
  return (
    <div
      className="w-0 min-w-full"
      style={{
        paddingTop: selected !== null ? '10px' : '0px',
      }}
    >
      {NavbarLinks.map((link, index) => (
        <AnimateHeight
          key={index}
          className="flex flex-col gap-[6px] overflow-hidden"
          isVisible={selected === index}
          duration={0.1}
        >
          <div className="text-tiny pb-1">{link.subtitle}</div>
          {link.links
            ? link.links.map((sublink, subindex) => (
                <div
                  key={subindex}
                  className="rounded-lg pl-4 pt-2 transition-all hover:bg-gray-100"
                >
                  <a
                    href={sublink.href}
                    className="font-bold text-[#222] no-underline hover:text-[#0a0c13] dark:text-white/90 dark:hover:text-white"
                  >
                    <p>{sublink.title}</p>
                  </a>
                  {sublink.title == 'Socials' ? (
                    <div className="pb-1 text-sm">{sublink.description}</div>
                  ) : (
                    <div className="pb-1 text-sm">
                      <a href={sublink.href} className="no-underline">
                        <p>{'' + sublink.description}</p>
                      </a>
                    </div>
                  )}
                </div>
              ))
            : null}
        </AnimateHeight>
      ))}
    </div>
  );
};

export default Menus;
