import { ColumnSort } from '@tanstack/react-table';
import { SortingState } from '@tanstack/react-table';
import { Dispatch, SetStateAction } from 'react';

export interface StateProps {
  sorting: SortingState;
  [key: string]: any;
}

export interface SetStateProps {
  setSorting: (sorting: ColumnSort[]) => void;
  [key: string]: Dispatch<SetStateAction<any>>;
}
