import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import { QueryResult } from '@/types/usage';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/UI/accordion';
import { Copy } from 'lucide-react'; // For copy functionality
import { ScrollArea } from '@/components/UI/scroll-area'; // Ensure the correct path
import { Separator } from '../../UI/separator';
import { CopyButton } from '../../Common/Buttons/Copy';

interface QueryHistoryTableProps {
  queries: QueryResult[];
}

export default function QueryHistoryTable({ queries }: QueryHistoryTableProps) {
  // State to manage the selected query and sheet visibility
  const [openSheet, setOpenSheet] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<QueryResult | null>(null);

  const handleRowClick = (query: QueryResult) => {
    setSelectedQuery(query);
    setOpenSheet(true);
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Handle the error if needed
      console.error('Failed to copy text to clipboard.');
    });
  };

  // Function to truncate text to a specified length
  const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  return (
    <>
      {/* Existing table component */}
      <Table className="QueriesTable">
        <TableCaption>{queries.length ? '' : "You haven't made any API calls yet."}</TableCaption>
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
              <TableRow
                key={index}
                onClick={() => handleRowClick(query)}
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              >
                <TableCell>{new Date(query.at).toLocaleString()}</TableCell>
                <TableCell>{query.endpoint.split('@')[0]}</TableCell>
                <TableCell>{query.endpoint.split('@')[1]}</TableCell>
                <TableCell>{query.tags?.join(', ') || 'No tags'}</TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {query.messages[query.messages.length - 2]?.content
                    ? truncateText(query.messages[query.messages.length - 2].content, 100)
                    : 'No prompt'}
                </TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {query.messages[query.messages.length - 1]?.content
                    ? truncateText(query.messages[query.messages.length - 1].content, 100)
                    : 'No response'}
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

      {/* Sheet Component for Detailed View */}
      {selectedQuery && (
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          {/* Adjust SheetContent to be a flex container */}
          <SheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
            <SheetHeader>
              <SheetTitle>Query Details</SheetTitle>
              <SheetDescription>Detailed information about the query.</SheetDescription>
            </SheetHeader>
            <Separator />

            {/* Make the main content scrollable */}
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 py-4">
                {/* Display basic query information */}
                <div>
                  <strong>Date:</strong> {new Date(selectedQuery.at).toLocaleString()}
                </div>
                <div>
                  <strong>Model:</strong> {selectedQuery.endpoint.split('@')[0]}
                </div>
                <div>
                  <strong>Provider:</strong> {selectedQuery.endpoint.split('@')[1]}
                </div>
                <div>
                  <strong>Tags:</strong> {selectedQuery.tags?.join(', ') || 'No tags'}
                </div>

                {/* Accordion Component */}
                <Accordion type="single" collapsible>
                  {/* Prompt Accordion Item */}
                  <AccordionItem value="prompt">
                    <div className="flex items-center justify-between">
                      <AccordionTrigger>
                        <strong>Prompt</strong>
                      </AccordionTrigger>
                      {/* Copy Prompt Button */}
                      {selectedQuery.messages[selectedQuery.messages.length - 2]?.content && (
                        <CopyButton
                          content={
                            selectedQuery.messages[selectedQuery.messages.length - 2].content
                          }
                          copyMessage="Prompt copied to clipboard"
                          tooltipContent="Copy Prompt"
                          className="h-5 w-5"
                        />
                      )}
                    </div>
                    <AccordionContent>
                      <p className="whitespace-pre-wrap">
                        {selectedQuery.messages[selectedQuery.messages.length - 2]?.content ||
                          'No prompt'}
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Response Accordion Item */}
                  <AccordionItem value="response">
                    <div className="flex items-center justify-between">
                      <AccordionTrigger>
                        <strong>Response</strong>
                      </AccordionTrigger>
                      {/* Copy Response Button */}
                      {selectedQuery.messages[selectedQuery.messages.length - 1]?.content && (
                        <CopyButton
                          content={
                            selectedQuery.messages[selectedQuery.messages.length - 1].content
                          }
                          copyMessage="Response copied to clipboard"
                          tooltipContent="Copy Response"
                          className="h-5 w-5"
                        />
                      )}
                    </div>
                    <AccordionContent>
                      <p className="whitespace-pre-wrap">
                        {selectedQuery.messages[selectedQuery.messages.length - 1]?.content ||
                          'No response'}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
