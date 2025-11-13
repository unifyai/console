import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/UI/table"
import { ReactNode } from "react";

export  function BaseTable ({items, headers, caption, footer} : {
    items: {[key: string]: any}[],
    headers?: ReactNode[],
    caption?: string,
    footer?: any
}) {
    
    const columns = items.length ? Object.keys(items[0]) : [];
    const labels = headers ? headers : columns;

    return (
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            {labels.map((column, index) => 
                <TableHead key={index} className="px-2 py-1">{column}</TableHead>    
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
                {columns.map((column, index) => 
                    <TableCell key={index} className="px-2 py-1 text-body-sm">{item[column]}</TableCell>
                )}
            </TableRow>
          ))}
        </TableBody>
        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>
    )
  }