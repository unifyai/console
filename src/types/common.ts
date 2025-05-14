/** 
 * Base FastAPI response format for endpoints that don't
 * explicitly return data. Can be:
 * { info : success_message } for successful responses, or
 * { detail: error_message } for unsuccessful responses
*/
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

export interface TreeNode {
    path: string;
    children: { [key: string]: TreeNode };
    isComplete: boolean;
}
