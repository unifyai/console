export type DataPoint = [number, number];

export type DataLabel = [string, number];

export type GroupedDataPoint = [string, DataPoint[]];

export type GroupedDataLabel = [string, DataLabel[]];

export type GroupingColors = {key: string, color: string}[];

export type InfoCardData = {
    x : {"name": string, "value": string | number},
    y : {"name": string, "value": number},
    group? : {"name": string, "value": string | number}
} 

export type InfoCardPosition = { x: number, y: number}