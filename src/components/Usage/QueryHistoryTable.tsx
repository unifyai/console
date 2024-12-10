import React from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/UI/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/UI/tooltip";
import { QueryResult } from "@/types/usage";

interface QueryHistoryTableProps {
  queries: QueryResult[];
}

export default function QueryHistoryTable({ queries }: QueryHistoryTableProps) {
  return (
    <Table className="QueriesTable">
      <TableCaption>
        {queries.length
          ? ""
          : "You haven't made any API calls yet."}
      </TableCaption>
      <TableHeader className="sticky top-0">
        <TableRow className="bg-background">
          <TableHead>Date</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Prompt</TableHead>
          <TableHead>Response</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.length ? (
          queries.map((query, index) => (
            <TableRow key={index}>
              <TableCell>{new Date(query.at).toLocaleString()}</TableCell>
              <TableCell>{query.endpoint.split('@')[0]}</TableCell>
              <TableCell>{query.endpoint.split('@')[1]}</TableCell>
              <TableCell>{query.tags?.join(', ') || 'No tags'}</TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate max-w-[150px]">
                        {query.messages[query.messages.length - 2]?.content || 'No prompt'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{query.messages[query.messages.length - 2]?.content || 'No prompt'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate max-w-[150px]">
                        {query.messages[query.messages.length - 1]?.content || 'No response'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{query.messages[query.messages.length - 1]?.content || 'No response'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center">
              No queries found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}