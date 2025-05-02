export interface ResponseProps {
    [key: string]: string
}

export interface CustomResponseProps {
    success: false,
    message: string,
    [key: string]: any
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

export interface TreeNode {
    path: string;
    children: { [key: string]: TreeNode };
    isComplete: boolean;
}
