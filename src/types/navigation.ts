export interface NavItem {
    title: string;
    icon: any;
    href: string;
    tabs?: NavItem[]
}

export interface MobileNavParams {
    children?: React.ReactNode;
    mobileChildren?: React.ReactNode;
    menuOpen: boolean;
}
