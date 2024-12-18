export type DataPoint = [number, number];

export type DataLabel = [string, number];

export type GroupedDataPoint = [string, DataPoint[]];

export type GroupedDataLabel = [string, DataLabel[]];

export type GroupingColors = {key: string, color: string}[];