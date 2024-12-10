interface HamburgerMenuProps {
    onClick: () => void;
    open: boolean;
}

const HamburgerMenu = ({ onClick, open }: HamburgerMenuProps) => {
    const hamburgerClass = "w-5 h-0.5 transition-all ease-out rounded-xl bg-[var(--foreground-color)]";

    return (<div className="lg:hidden py-[10px] px-[4px] z-50" onClick={onClick}>
        <div
            className={hamburgerClass}
            style={{
                transform: open ? "translate(0px, 0.35rem) rotate(45deg)" : "none",
            }}
        />
        <div
            className={`${hamburgerClass} my-1`}
            style={{
                opacity: open ? 0 : 1,
            }}
        />
        <div
            className={hamburgerClass}
            style={{
                transform: open ? "translate(0px, -0.35rem) rotate(-45deg)" : "none",
            }}
        />
    </div>);
};

export default HamburgerMenu;
