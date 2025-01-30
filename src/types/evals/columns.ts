import { Transform } from "@dnd-kit/utilities";

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

export interface DraggingColumnsState {
    active: {
        ids: string[];
        transform?: Transform | null;
    };
    over: {
        ids: string[];
        transform?: Transform | null;
    };
}

export interface PinningColumnState {
    columnId: string | null;
    isPinning: boolean;
    direction: 'left' | 'right' | null;
    transform: Transform | null;
}
