/**
 * Preprocesses markdown content to prevent indented text (4+ spaces) from becoming code blocks,
 * while preserving line breaks, lists, tables, and header formatting.
 *
 * @param markdown The original markdown content
 * @returns Preprocessed markdown with correct formatting
 */
export function preprocessMarkdown(markdown: string): string {
  // Split the content into lines for processing
  const lines = markdown.split('\n');
  const processedLines = [];

  // Track state to identify code block context
  let inFencedCodeBlock = false;
  let inListItem = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trimStart();

    // Check if we're entering or exiting a fenced code block
    if (trimmedLine.startsWith('```')) {
      inFencedCodeBlock = !inFencedCodeBlock;
      processedLines.push(line);
      continue;
    }

    // Skip processing inside fenced code blocks
    if (inFencedCodeBlock) {
      processedLines.push(line);
      continue;
    }

    // Check for table rows
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      inTable = true;
      processedLines.push(line);
      continue;
    }

    // Check for table dividers
    if (trimmedLine.startsWith('|') && trimmedLine.includes('-') && line.includes('|')) {
      processedLines.push(line);
      continue;
    }

    // Reset table state if we're not seeing table content anymore
    if (inTable && !trimmedLine.startsWith('|')) {
      inTable = false;
    }

    // NEW CODE: Check specifically for list items with 4+ spaces at the beginning
    // and fix them to prevent being interpreted as code blocks
    const startsWithFourSpaces = line.startsWith('    ');
    const isOrderedListItem = /^\s*\d+\.\s/.test(trimmedLine);
    const isUnorderedListItem = /^\s*[-*+]\s/.test(trimmedLine);

    if (startsWithFourSpaces && (isOrderedListItem || isUnorderedListItem)) {
      // Replace 4 spaces with 3 spaces to avoid code block interpretation
      // while maintaining indentation
      const processedLine = line.replace(/^    /, '   ');
      processedLines.push(processedLine);
      inListItem = true;

      continue;
    }

    // Check for list items - traditional markers and preserve them
    const isListItem = /^(\s*)([-*+]|\d+\.)\s/.test(line);
    if (isListItem) {
      inListItem = true;
      processedLines.push(line);
      continue;
    }

    // Check for continuation of list items (indented but not a new list item)
    if (inListItem && line.startsWith('  ') && !isListItem) {
      processedLines.push(line);
      continue;
    }

    // Reset list state if we're seeing a blank line
    if (inListItem && trimmedLine === '') {
      inListItem = false;
    }

    // Check for headers
    if (trimmedLine.startsWith('#')) {
      processedLines.push(line);
      continue;
    }

    // Check for horizontal rules
    if (/^(\s*)([-*_])\s*\2\s*\2\s*\2*$/.test(line)) {
      processedLines.push(line);
      continue;
    }

    // The critical part: Check if this is an indented code block
    // (starts with 4+ spaces, not a list item, not in a table, not a header)
    if (line.startsWith('    ') && !inListItem && !inTable) {
      // Convert only the first 4 spaces to HTML entities
      const processedLine = line.replace(/^    /, '&nbsp;&nbsp;&nbsp;&nbsp;');
      processedLines.push(processedLine);
      continue;
    }

    // Default: pass through unchanged
    processedLines.push(line);
  }

  return processedLines.join('\n');
}

/**
 * A simpler version that only targets code blocks without trying to handle complex markdown
 * May be more reliable for simple use cases but won't handle complex nesting
 */
export function simplePreprocessMarkdown(markdown: string): string {
  // Only target lines that start with exactly 4 spaces and aren't part of other structures
  return markdown.replace(/^(    )(?![\s*+-]|[0-9]+\.|>)(.+)$/gm, '&nbsp;&nbsp;&nbsp;&nbsp;$2');
}

/**
 * Examples of how to use the preprocessor:
 *
 * const markdown = `
 * # Heading
 *
 * Normal paragraph.
 *
 *     This would normally be a code block
 *     because it's indented with 4 spaces.
 *
 * Back to normal text.
 * `;
 *
 * const processed = preprocessMarkdown(markdown);
 * <ReactMarkdown>{processed}</ReactMarkdown>
 */
