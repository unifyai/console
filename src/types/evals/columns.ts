export interface FilterMode {
    icon: JSX.Element;
    name: string;
    fn: string;
    hint: string;
}

export interface Filters { 
    [fn: string]: string 
}

export interface FiltersByColumn {
    [key: string] : Filters
}