'use client';

import {
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/UI/table';

export const EmptyTable = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-label bg-[var(--white-smoke)] py-2 text-center">
            Logs
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="EmptyLogsTable text-body-sm h-[21px] py-2 text-center text-muted-foreground">
            Select a project to display your logs.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};
