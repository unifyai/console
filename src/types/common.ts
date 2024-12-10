export interface ResponseProps {
    [key: string]: string
}

export interface FileProps {
    path: string,
    type?: string,
    data?: any
}

export interface NodeProps {
    name: string;
    path: string;
    type?: string;
    data?: any;
    nodes?: NodeProps[];
}
