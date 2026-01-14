'use client';

import { useEffect, useState } from 'react';
import { BasePopover } from '@/components/Common/Popovers/Base';
import { Columns3, LoaderCircle } from 'lucide-react';
import SettingButton from '@/components/Common/Buttons/Setting';
import { Switch } from '@/components/UI/switch';
import {
  processContext,
  sanitizeId,
  updateColumnVisibility,
} from '@/utils/interfaces/table/columnOperations';
import { LogProps, LogFieldsResponseProps, GroupedLogProps } from '@/types/interfaces/logs';

const VisibilityFilter = ({
  fields,
  columnVisibility,
  setColumnVisibility,
  context,
  defaultHidden,
  setDefaultHidden,
}: {
  fields: LogFieldsResponseProps;
  columnVisibility: { [key: string]: boolean };
  setColumnVisibility: (x: { [key: string]: boolean }) => void;
  context: string | null;
  defaultHidden: boolean;
  setDefaultHidden: (val: boolean) => void;
}) => {
  const entryColumns = fields ? Object.entries(fields).map(([key, value]) => `Entries/${key}`) : [];

  const anyHiddenEntry = Object.entries(columnVisibility)
    .filter(([column, visible]) => column.startsWith('Entries'))
    .some(([colum, visible]) => !visible);

  const anyHidden = anyHiddenEntry;

  /* Event handlers */
  const handleAllCheck = () => {
    const state = anyHidden ? true : false;
    const newColumnVisibility = {
      RowNumbering: true,
      ...Object.fromEntries(
        Object.entries(columnVisibility)
          .filter(([k, _]) => k !== 'RowNumbering')
          .map(([key]) => [key, state])
      ),
    };
    setColumnVisibility(newColumnVisibility);
  };
  // Params support removed - handleAllParamsCheck no longer needed
  const handleAllEntriesCheck = () => {
    const state = anyHiddenEntry ? true : false;
    const newColumnVisibility = {
      ...columnVisibility,
      RowNumbering: true,
      ...Object.fromEntries(
        Object.entries(columnVisibility)
          .filter(([k, _]) => k.startsWith('Entries'))
          .map(([key]) => [key, state])
      ),
    };
    setColumnVisibility(newColumnVisibility);
  };
  const handleSingleCheck = (column: string) => {
    const isVisible = !columnVisibility[column];
    const newColumnVisibility = updateColumnVisibility(columnVisibility, column, isVisible);
    setColumnVisibility(newColumnVisibility);
  };

  /* Show / hide all columns */
  const hideAll = (
    <div className="mb-5 mt-3 flex items-center justify-between">
      <span className="text-label text-strong">{anyHidden ? 'Show all' : 'Hide all'}</span>
      <Switch checked={!anyHidden} onCheckedChange={handleAllCheck} />
    </div>
  );

  /* Params toggles removed - params support no longer available */
  const hideParams = null;

  /* Entries toggles - moved to appear after Params */
  const hideEntries = (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-label text-strong">Entries</p>
        <Switch checked={!anyHiddenEntry} onCheckedChange={handleAllEntriesCheck} />
      </div>
      {entryColumns.map((column, index) => (
        <div key={index} className="flex items-center justify-between py-1 pl-4">
          <span className="text-body-sm max-w-[200px] truncate" title={column}>
            {context ? sanitizeId(processContext('split', context, column)) : column}
          </span>
          <Switch
            checked={columnVisibility[column]}
            onCheckedChange={() => handleSingleCheck(column)}
          />
        </div>
      ))}
    </div>
  );

  /* Popover trigger */
  const button = <SettingButton tooltip={'Show / hide columns'} icon={<Columns3 />} />;

  return (
    <BasePopover button={button} context="tile">
      <div className="flex flex-col gap-1 p-3">
        <p className="text-title pb-1 font-bold">Select visible columns</p>
        <div
          className="max-h-[60vh] overflow-y-auto pr-2"
          onWheel={(e) => {
            e.stopPropagation();
            const container = e.currentTarget;
            container.scrollTop += e.deltaY;
          }}
        >
          {/* Toggle for default hide underscore columns */}
          {/* 
                <div className="flex justify-between items-center mb-3">
                    <span className="text-label text-strong">Hide private columns</span>
                    <Switch checked={defaultHidden} onCheckedChange={setDefaultHidden}/>
                </div>
                */}
          {hideAll}
          {hideParams}
          {hideEntries}
        </div>
      </div>
    </BasePopover>
  );
};

export default VisibilityFilter;
