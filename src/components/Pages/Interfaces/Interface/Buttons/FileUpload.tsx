"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ActionButton from "../../../../Common/Buttons/Action";
import { Button } from "@/components/UI/button";
import { Label } from "@/components/UI/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/UI/command";
import { Switch } from "@/components/UI/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/UI/table";
import { ScrollArea, ScrollBar } from "@/components/UI/scroll-area";
import { showLoadingToast, showErrorToast, showSuccessToast } from "@/components/Common/Toasts/notifications";
import { Loader2, Upload, FileText, Trash2, X, AlertCircle, ChevronsUpDown, Check } from "lucide-react"; // Added ChevronsUpDown, Check
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { LogsActions, Context } from '@/types/interfaces/grid';
import { ResponseProps } from "@/types/common";
import BaseDialog from "../../../../Common/Dialogs/Base";

interface FileUploadProps {
    project: string | null;
    contexts: Context[];
    logsActions: LogsActions;
    customOpen?: boolean;
    setCustomOpen?: (open: boolean) => void;
}

type ParsedData = {
    headers: string[];
    rows: Record<string, any>[];
    previewRows: Record<string, any>[];
};

type ColumnType = 'param' | 'entry';

const MAX_PREVIEW_ROWS = 20;
const ALLOWED_EXTENSIONS = ['.csv', '.jsonl', '.json'];

export function FileUpload({ project, logsActions, contexts, customOpen, setCustomOpen }: FileUploadProps) {
    const [open_, setOpen_] = useState(false);
    const open = customOpen !== undefined ? customOpen : open_;
    const setOpen = setCustomOpen || setOpen_;
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [columnTypes, setColumnTypes] = useState<Record<string, ColumnType>>({});

    const [contextInputValue, setContextInputValue] = useState<string>("");
    const [isContextPopoverOpen, setIsContextPopoverOpen] = useState(false);

    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-dismiss error message
    useEffect(() => {
        if (error) {
            // Clear previous timeout if exists
            if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current);
            }
            // Set new timeout
            errorTimeoutRef.current = setTimeout(() => {
                setError(null);
                errorTimeoutRef.current = null;
            }, 5000); // 5 seconds
        }

        // Cleanup timeout on component unmount or when error changes
        return () => {
            if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current);
            }
        };
    }, [error]);

    const resetState = useCallback(() => {
        setFile(null);
        setParsedData(null);
        setColumnTypes({});
        setContextInputValue(""); // Reset combobox input
        setIsUploading(false);
        setError(null);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current); // Clear error timeout
    }, []);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            const timer = setTimeout(() => {
                resetState();
            }, 300); // Delay reset slightly for animation
            return () => clearTimeout(timer);
        }
    }, [open, resetState]);

    const checkHeadersForDuplicates = (hdrArray: string[], sourceDescription: string): void => {
        const unique = new Set(hdrArray);
        if (unique.size < hdrArray.length) {
          const counts: Record<string, number> = {};
          const dups: string[] = [];
          for (const h of hdrArray) {
            counts[h] = (counts[h] || 0) + 1;
            if (counts[h] === 2) dups.push(`"${h}"`);
          }
          throw new Error(
            `Duplicate ${sourceDescription} found: ${dups.join(', ')}. Please ensure all keys are unique.`
          );
        }
      };
      
    /**
     * Extract **top-level** quoted keys from a JSON-looking snippet.
     *
     * 1. **Fast-path – valid JSON** → `JSON.parse`, `Object.keys`.
     * 2. **Graceful fallback** → regex approach that removes nested structures
     *    first, then extracts top-level keys only.
     *
     * This handles both single-line and multi-line JSON strings efficiently.
     */
    const extractTopLevelKeys = (text: string): string[] => {
      // ---------- Fast path ------------------------------------------------
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          return Object.keys(obj);
        }
      } catch {
        /* fall through to RegExp path */
      }
      
      // ---------- RegExp fallback ------------------------------------------
      // Strategy: Remove nested objects/arrays, then extract remaining keys
      let cleanedText = text;
      
      // Remove nested objects by replacing {...} with placeholder
      // This regex matches balanced braces
      let prevLength;
      do {
        prevLength = cleanedText.length;
        cleanedText = cleanedText.replace(/\{[^{}]*\}/g, '{}');
      } while (cleanedText.length !== prevLength);
      
      // Remove nested arrays by replacing [...] with placeholder
      do {
        prevLength = cleanedText.length;
        cleanedText = cleanedText.replace(/\[[^\[\]]*\]/g, '[]');
      } while (cleanedText.length !== prevLength);
      
      // Now extract keys from the cleaned text
      const keyPattern = /(?:^[^"]*\{|,)\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g;
      const keys: string[] = [];
      let match: RegExpExecArray | null;
      
      while ((match = keyPattern.exec(cleanedText)) !== null) {
        keys.push(match[1]);
      }
      
      return keys;
    };
      
    const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
        const parseFile = async (selectedFile: File): Promise<ParsedData> => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
          
              reader.onload = async (event) => {
                try {
                  const text = (event.target?.result as string) || '';
                  if (!text.trim()) {
                    throw new Error("File is empty or contains only whitespace.");
                  }
          
                  let headers: string[] = [];
                  let rows: Record<string, any>[] = [];
          
                  if (selectedFile.name.endsWith('.csv')) {
                    // — CSV Handling —
                    let rawHeaders: string[] = [];
                    let previewError: Error | null = null;
          
                    Papa.parse(text, {
                      preview: 1,
                      skipEmptyLines: true,
                      complete: (results) => {
                        if (
                          results.data.length === 0 ||
                          !Array.isArray(results.data[0])
                        ) {
                          previewError = new Error("Could not parse header row from CSV.");
                        } else {
                          rawHeaders = (results.data[0] as string[]).map(h => h.trim());
                          if (rawHeaders.every(h => !h)) {
                            previewError = new Error(
                              "CSV header row is empty or contains only delimiters."
                            );
                          }
                        }
                        if (results.errors.length && !previewError) {
                          previewError = new Error(
                            `Error parsing CSV header: ${results.errors[0].message}`
                          );
                        }
                      },
                    });
          
                    if (previewError) throw previewError;
                    if (!rawHeaders.length) throw new Error("CSV must have a header row.");
          
                    checkHeadersForDuplicates(rawHeaders, "column names in CSV header");
          
                    const full = Papa.parse<Record<string, any>>(text, {
                      header: true,
                      skipEmptyLines: true,
                      transformHeader: h => h.trim(),
                    });
                    if (full.errors.length) {
                      throw new Error(
                        `CSV Parsing Error (Row ${full.errors[0].row}): ${full.errors[0].message}`
                      );
                    }
          
                    headers = rawHeaders;
                    rows = full.data;
                    if (!rows.length) {
                      throw new Error("CSV contains no data rows after the header.");
                    }
          
                  } else if (selectedFile.name.endsWith('.jsonl')) {
                    // — JSONL with regex pre‑scan —
                    const lines = text
                      .trim()
                      .split('\n')
                      .map(l => l.trim())
                      .filter(l => l);
          
                    if (!lines.length) {
                      throw new Error("JSONL file is empty or contains only empty lines.");
                    }
          
                    // extract keys from the very first line before parsing
                    const rawKeys = extractTopLevelKeys(lines[0]);
                    checkHeadersForDuplicates(rawKeys, "keys in the first JSONL object literal");
          
                    rows = lines.map((line, i) => {
                      try {
                        return JSON.parse(line);
                      } catch (e: any) {
                        throw new Error(`Error parsing JSONL on line ${i + 1}: ${e.message}`);
                      }
                    });
          
                    headers = rawKeys;
          
                  } else if (selectedFile.name.endsWith('.json')) {
                    // — JSON with regex pre‑scan —
                    // find the first `{ ... }` inside the top‑level array
                    const firstObjMatch = text.match(/^\s*\[\s*({[\s\S]*?})/);
                    if (!firstObjMatch) {
                      throw new Error("Could not locate the first object literal in JSON.");
                    }
          
                    const rawKeys = extractTopLevelKeys(firstObjMatch[1]);
                    checkHeadersForDuplicates(rawKeys, "keys in the first JSON object literal");
          
                    let parsedJson: any;
                    try {
                      parsedJson = JSON.parse(text);
                    } catch (e: any) {
                      throw new Error(`Error parsing JSON: ${e.message}`);
                    }
          
                    if (!Array.isArray(parsedJson)) {
                      throw new Error("JSON file must contain a top‑level array.");
                    }
                    if (parsedJson.length === 0) {
                      throw new Error("JSON array is empty.");
                    }
          
                    rows = parsedJson.filter(
                      item => item && typeof item === 'object' && !Array.isArray(item)
                    );
                    if (!rows.length) {
                      throw new Error("JSON array contains no valid object items.");
                    }
          
                    headers = rawKeys;
          
                  } else {
                    throw new Error("Unsupported file type.");
                  }
          
                  // Final sanity checks
                  if (!headers.length) {
                    throw new Error("Could not determine headers/keys from the file.");
                  }
                  if (!rows.length) {
                    throw new Error("File contains no data rows after parsing.");
                  }
          
                  resolve({
                    headers,
                    rows,
                    previewRows: rows.slice(0, MAX_PREVIEW_ROWS),
                  });
                } catch (err: any) {
                  reject(err);
                }
              };
          
              reader.onerror = () => {
                reject(new Error("Error reading file."));
              };
          
              reader.readAsText(selectedFile);
            });
        };
        setError(null);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current); // Clear error timeout
        setParsedData(null);
        setColumnTypes({});
        const selectedFile = acceptedFiles[0];

        if (!selectedFile) return;

        const fileExtension = selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
            setError(`Invalid file type. Please upload ${ALLOWED_EXTENSIONS.join(', ')}.`);
            setFile(null);
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB limit
        if (selectedFile.size > maxSize) {
            setError(`File size exceeds the limit of ${maxSize / 1024 / 1024}MB.`);
            setFile(null);
            return;
        }

        setFile(selectedFile);
        try {
            const data = await parseFile(selectedFile);
            setParsedData(data);
            const initialTypes: Record<string, ColumnType> = {};
            data.headers.forEach(header => {
                initialTypes[header] = 'entry';
            });
            setColumnTypes(initialTypes);
        } catch (e: any) {
            console.error("Parsing failed:", e);
            setError(`Failed to parse file: ${e.message}`);
            setFile(null);
            setParsedData(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: handleFileDrop,
        multiple: false,
        accept: {
            'text/csv': ['.csv'],
            'application/json': ['.json'],
            'application/x-jsonlines': ['.jsonl'],
        },
        disabled: isUploading,
    });

    const handleColumnTypeChange = (header: string, type: ColumnType) => {
        setColumnTypes(prev => ({ ...prev, [header]: type }));
    };

    const handleUpload = async () => {
        if (!file || !parsedData || !project || isUploading) return;

        // e: Allow upload without context
        const finalContext = contextInputValue.trim() ? contextInputValue.trim() : null;

        const paramKeys = Object.keys(columnTypes).filter(k => columnTypes[k] === 'param');
        const entryKeys = Object.keys(columnTypes).filter(k => columnTypes[k] === 'entry');

        if (entryKeys.length === 0) {
            showErrorToast("Please mark at least one column as 'Entry'.");
            setError("At least one column must be marked as 'Entry'.");
            return;
        }

        const allRows = parsedData.rows;
        const paramsArray: Record<string, any>[] = [];
        const entriesArray: Record<string, any>[] = [];

        allRows.forEach(row => {
            const paramObj: Record<string, any> = {};
            paramKeys.forEach(key => {
                if (row.hasOwnProperty(key)) {
                    paramObj[key] = row[key];
                }
            });
            const entryObj: Record<string, any> = {};
            entryKeys.forEach(key => {
                if (row.hasOwnProperty(key)) {
                    entryObj[key] = row[key];
                }
            });
            paramsArray.push(paramObj);
            entriesArray.push(entryObj);
        });

        setIsUploading(true);
        setError(null); // Clear previous errors
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        const toastId = showLoadingToast(`Uploading ${allRows.length} logs...`);

        try {
            const response: ResponseProps = await logsActions.create(
                project,
                finalContext,
                paramsArray,
                entriesArray,
            );

            if (response && response.info) {
                showSuccessToast(response.info, undefined, toastId);
                setOpen(false); // Close dialog on success
            } else if (response && response.detail) {
                throw new Error(response.detail);
            } else {
                throw new Error("Unknown error during upload.");
            }
        } catch (e: any) {
            console.error("Upload failed:", e);
            setError(`Upload failed: ${e.message}`);
            showErrorToast(e.message, `Upload failed: ${e.message}`, toastId);
        } finally {
            setIsUploading(false);
        }
    };

// Allow upload if file parsed and project selected, regardless of context. Block if error is present.
    const canUpload = !!file && !!parsedData && !!project && !isUploading && error === null; 

    // Calculate column spans for header
    const paramHeaders = parsedData?.headers.filter(h => columnTypes[h] === 'param') ?? [];
    const entryHeaders = parsedData?.headers.filter(h => columnTypes[h] === 'entry') ?? [];
    const paramColSpan = paramHeaders.length;
    const entryColSpan = entryHeaders.length;


    return (
        <BaseDialog
            open={open}
            setOpen={setOpen}
            className="sm:max-w-[75vw] max-h-[90vh] flex flex-col" // Increased width slightly
            button={
                <ActionButton
                    text="Upload Logs"
                    icon={<Upload />}
                    onClick={() => setOpen(true)}
                    tooltip="Upload logs from file (.csv, .jsonl, .json)"
                    variant="ghost"
                    disabled={!project}
                />
            }
            body={
                <>
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
                        {/* State A: No File Uploaded */}
                        {!file && (
                             <div
                                {...getRootProps()}
                                className={cn(
                                    "flex-1 group relative grid place-items-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-5 py-10 text-center transition hover:bg-muted/25 cursor-pointer", // Increased py
                                    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    isDragActive && "border-muted-foreground/50",
                                    isUploading && "pointer-events-none opacity-60"
                                )}
                            >
                                <input {...getInputProps()} disabled={isUploading} />
                                <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                                    <Upload className="size-10 text-muted-foreground" aria-hidden="true" />
                                    <p className="font-medium text-muted-foreground">
                                        {isDragActive ? "Drop the file here" : "Drag 'n' drop a file here, or click to select"}
                                    </p>
                                    <div className="flex flex-col gap-1 text-sm text-muted-foreground/70 justify-start">
                                        <span>Supported:</span>
                                        <ul className="ml-2"> 
                                            <li>-.csv, with column names listed on the first line</li>
                                            <li>-.jsonl, with repeated column names in every line</li>
                                            <li>-.json, as a list of dicts with a list at the base</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* State B: File Uploaded and Parsed */}
                        {file && parsedData && (
                            <div className="flex flex-col gap-4 overflow-hidden flex-1">
                                {/* File Info Bar */}
                                <div className="flex items-center gap-2 border p-2 rounded-md bg-muted/50">
                                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-medium truncate flex-1" title={file.name}>{file.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={resetState}
                                        disabled={isUploading}
                                        aria-label="Remove file"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Column Mapping & Preview */}
                                <div className="flex gap-4 flex-1 overflow-hidden">
                                    {/* Column Switches */}
                                    <div className="flex flex-col gap-3 border rounded-md p-3 overflow-y-auto max-w-[220px]"> {/* Increased width slightly */}
                                        <p className="font-semibold text-sm mb-2">Map Columns</p>
                                        {parsedData.headers.map(header => (
                                            <div key={header} className="flex items-center justify-between gap-2">
                                                <Label htmlFor={`switch-${header}`} className="text-sm truncate flex-1 cursor-pointer" title={header}>
                                                    {header}
                                                </Label>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Label
                                                        htmlFor={`switch-${header}`}
                                                        className={cn(
                                                            "text-xs cursor-pointer",
                                                            columnTypes[header] === 'param' ? 'text-primary font-medium' : 'text-muted-foreground'
                                                        )}
                                                    >
                                                        Param
                                                    </Label>
                                                    <Switch
                                                        id={`switch-${header}`}
                                                        checked={columnTypes[header] === 'entry'}
                                                        onCheckedChange={(checked) => handleColumnTypeChange(header, checked ? 'entry' : 'param')}
                                                        disabled={isUploading}
                                                        aria-label={`Mark ${header} as ${columnTypes[header] === 'entry' ? 'Parameter' : 'Entry'}`}
                                                    />
                                                    <Label
                                                        htmlFor={`switch-${header}`}
                                                        className={cn(
                                                             "text-xs cursor-pointer",
                                                             columnTypes[header] === 'entry' ? 'text-primary font-medium' : 'text-muted-foreground'
                                                        )}
                                                        >
                                                         Entry
                                                     </Label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Table Preview */}
                                    <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
                                        <p className="font-semibold text-sm p-3 border-b">
                                            File Preview (up to {MAX_PREVIEW_ROWS} rows shown)
                                        </p>
                                        {/* Scrollable area for table, limiting visible height */}
                                        <ScrollArea className="flex-1 h-[300px]"> {/* Adjust h-[...] as needed for ~5 rows visibility */}
                                            <Table className="text-xs relative"> {/* Add relative for sticky header */}
                                                {/* Two-level table header */}
                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                     {/* Parent Headers */}
                                                    <TableRow>
                                                        {paramColSpan > 0 && (
                                                            <TableHead
                                                                colSpan={paramColSpan}
                                                                className="text-center bg-blue-50/50 font-semibold border-b border-r" // Added borders
                                                            >
                                                                Parameters
                                                            </TableHead>
                                                        )}
                                                        {entryColSpan > 0 && (
                                                             <TableHead
                                                                colSpan={entryColSpan}
                                                                className="text-center bg-green-50/50 font-semibold border-b" // Added border
                                                            >
                                                                Entries
                                                            </TableHead>
                                                        )}
                                                         {/* Add empty header if no params/entries exist to prevent layout shift? Maybe not needed. */}
                                                         {(paramColSpan === 0 && entryColSpan === 0) && <TableHead>No Columns Mapped</TableHead>}
                                                    </TableRow>
                                                     {/* Sub Headers (Column Names) */}
                                                    <TableRow>
                                                        {paramHeaders.map(header => (
                                                            <TableHead key={header} className="bg-blue-50/50 border-r"> {/* Added border */}
                                                                {header}
                                                            </TableHead>
                                                        ))}
                                                        {entryHeaders.map(header => (
                                                            <TableHead key={header} className="bg-green-50/50">
                                                                {header}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {parsedData.previewRows.map((row, rowIndex) => (
                                                        <TableRow key={rowIndex}>
                                                            {/* Render cells in the same order as headers */}
                                                            {paramHeaders.map(header => (
                                                                <TableCell
                                                                    key={`${rowIndex}-${header}-param`}
                                                                    className="max-w-[150px] truncate border-r" /* Added border */
                                                                    title={String(row[header] ?? '')}
                                                                >
                                                                    {String(row[header] ?? '')}
                                                                </TableCell>
                                                            ))}
                                                            {entryHeaders.map(header => (
                                                                <TableCell
                                                                    key={`${rowIndex}-${header}-entry`}
                                                                    className="max-w-[150px] truncate"
                                                                    title={String(row[header] ?? '')}
                                                                >
                                                                    {String(row[header] ?? '')}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <ScrollBar orientation="horizontal"/>
                                        </ScrollArea>
                                        {parsedData.rows.length > MAX_PREVIEW_ROWS && (
                                            <p className="text-xs text-muted-foreground p-2 border-t text-center">
                                                Showing first {MAX_PREVIEW_ROWS} of {parsedData.rows.length} total rows.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error Display Area  */}
                    {error && (
                        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md flex items-center gap-2 mb-4"> {/* Added mb-4 */}
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm flex-1">{error}</p>
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto flex-shrink-0" onClick={() => setError(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Context Selection Combobox */}
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <Label htmlFor="context-input">Context (Optional)</Label>
                            <Popover open={isContextPopoverOpen} onOpenChange={setIsContextPopoverOpen}>
                                <PopoverTrigger asChild>
                                     <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isContextPopoverOpen}
                                        disabled={isUploading || !project}
                                        className="w-full justify-between font-normal"
                                    >
                                         <span className="truncate">
                                            {contextInputValue || "Select or create context"}
                                         </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                                    <Command shouldFilter={true} >
                                        <CommandInput
                                            id="context-input"
                                            placeholder="Search or type new context..."
                                            value={contextInputValue}
                                            onValueChange={setContextInputValue}
                                            disabled={isUploading || !project}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                {contextInputValue.trim() ? (
                                                    <div className="py-6 text-center text-sm">
                                                    {`No context found. Type to create "${contextInputValue}".`}
                                                    </div>
                                                ) : (
                                                    <div className="py-6 text-center text-sm">
                                                    No contexts found.
                                                    </div>
                                                )}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {contexts.map((ctx) => (
                                                    <CommandItem
                                                        key={ctx.name}
                                                        value={ctx.name}
                                                        onSelect={(currentValue) => {
                                                            setContextInputValue(currentValue === contextInputValue ? "" : currentValue);
                                                            setIsContextPopoverOpen(false);
                                                        }}
                                                    >
                                                         <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                contextInputValue === ctx.name ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {ctx.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {!project && <p className="text-xs text-destructive mt-1">Select a project first.</p>}
                        </div>
                    </div>
                </>
            }
            footer={
                <div className="flex justify-end gap-2">
                     <Button
                        onClick={handleUpload}
                        disabled={!canUpload || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            "Upload Logs"
                        )}
                    </Button>
                </div>
            }
        />
    );
}