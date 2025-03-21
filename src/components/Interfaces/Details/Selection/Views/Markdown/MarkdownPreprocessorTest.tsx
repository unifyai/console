"use client";

import React, { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import { preprocessMarkdown, simplePreprocessMarkdown } from "@/utils/markdownPreprocessor";

const testMarkdown = `
# Comprehensive Markdown Test

## 1. Indented Code Block vs. Regular Text

This is a normal paragraph.

    // This line is indented by 4 spaces
    // It should NOT be a code block
    // But the indentation should be preserved
    // Let's see if it works!

And here's a regular paragraph after.

## 2. Real Code Block (Should Still Work)

\`\`\`javascript
function example() {
  console.log("This should still render as code");
}
\`\`\`

## 3. Line Breaks

Line one  
Line two (has 2 trailing spaces)  
Line three (also has 2 trailing spaces)

## 4. Lists

### Unordered Lists:
- List item 1
  - Nested list item (indented but should remain a list)
  - Another nested item
- List item 2

### Ordered Lists:
1. First item
   1. Sub-item A
   2. Sub-item B
2. Second item

## 5. Table Test

| Column A | Column B | Column C |
|----------|----------|----------|
| Cell A1  | Cell B1  | Cell C1  |
| Cell A2  | *italic* | **bold** |

## 6. Mixed Content Test

Here's a paragraph followed by:

    // Indented code block
    function test() {
      console.log("This should be plain text");
    }

1. Followed by a list
2. With multiple items
   - Including nested items
     - And deeply nested items

    And an indented block within a list
    Which should also work

## 7. Blockquotes

> This is a blockquote
> It continues here
>
> And has multiple paragraphs

## 8. Headers

# H1 header
## H2 header
### H3 header
#### H4 header

## 9. Emphasis

*Italic text*
**Bold text**
***Bold and italic***

## 10. Links and Images

[This is a link](https://example.com)

![This is an image alt text](https://example.com/image.jpg)
`;

export default function MarkdownPreprocessorTest() {
  const [showProcessed, setShowProcessed] = useState(true);
  const [processorType, setProcessorType] = useState<'full' | 'simple'>('full');
  
  const processedContent = processorType === 'full'
    ? preprocessMarkdown(testMarkdown)
    : simplePreprocessMarkdown(testMarkdown);
  
  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2 flex-wrap">
        <button 
          className={`px-4 py-2 rounded ${showProcessed ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setShowProcessed(true)}
        >
          Processed Markdown
        </button>
        <button 
          className={`px-4 py-2 rounded ${!showProcessed ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setShowProcessed(false)}
        >
          Raw Markdown
        </button>
        
        {showProcessed && (
          <>
            <span className="mx-2 self-center">Processor:</span>
            <button 
              className={`px-4 py-2 rounded ${processorType === 'full' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setProcessorType('full')}
            >
              Full
            </button>
            <button 
              className={`px-4 py-2 rounded ${processorType === 'simple' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setProcessorType('simple')}
            >
              Simple
            </button>
          </>
        )}
      </div>
      
      <div className="border p-4 rounded bg-white mb-4">
        <h2 className="text-lg font-bold mb-2">
          {showProcessed ? "With Preprocessing" : "Without Preprocessing (Default Behavior)"}
        </h2>
        
        {showProcessed ? (
          <div className="react-markdown-content border p-3 rounded">
            <MarkdownRenderer>
              {processedContent}
            </MarkdownRenderer>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold mb-1">Default Markdown Rendering:</h3>
            <div className="border border-gray-300 p-2 rounded react-markdown-content">
              <MarkdownRenderer preventIndentedCodeBlocks={false}>
                {testMarkdown}
              </MarkdownRenderer>
            </div>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">Debug Information</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Original Markdown:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto border border-gray-300">
              {testMarkdown}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Processed Markdown:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto border border-gray-300 whitespace-pre-wrap">
              {processedContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
} 