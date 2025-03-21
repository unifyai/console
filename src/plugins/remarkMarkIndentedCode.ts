import {Plugin} from "unified"
import {visit} from "unist-util-visit"

/**
 * A remark plugin that runs early and marks indented code blocks.
 * This adds the metadata needed for other plugins like 'disableIndentedCode'.
 */
export const remarkMarkIndentedCode: Plugin<[], any> = function remarkMarkIndentedCode() {
  console.log("remarkMarkIndentedCode plugin initialized");
  
  return function transform(tree, file) {
    console.log("remarkMarkIndentedCode transform running on tree:", tree.type);
    
    let codeBlocksFound = 0;
    let indentedCodeBlocks = 0;
    
    visit(tree, "code", (node) => {
      codeBlocksFound++;
      console.log("remarkMarkIndentedCode: Found code block:", {
        value: node.value ? node.value.substring(0, 30) + "..." : "no value",
        lang: node.lang,
        meta: node.meta,
        position: node.position,
        hasData: !!node.data
      });
      
      // If it has no language and no meta info, it's potentially an indented code block
      if (!node.lang && !node.meta) {
        // Look for clues that suggest it's an indented code block:
        // 1. Check if first line starts with spaces in the content
        const startsWithSpaces = node.value && /^\s{4}/.test(node.value.split('\n')[0]);
        
        // 2. Check if the position info suggests indentation 
        // (column position of code blocks often reflects their indentation)
        const hasIndentedPosition = node.position && 
          node.position.start.column > 1 && 
          !node.position.indent; // No explicit indent means it might be an implicit indent
        
        // 3. Check for common patterns of indented code blocks
        const hasIndentedPatterns = node.value && (
          // Look for lines with consistent indentation
          /\n\s{4}/g.test(node.value) ||
          // Common patterns in indented code often have consistent spacing
          /^\s{4}.*\n\s{4}/m.test(node.value)
        );
        
        // If any of these conditions suggest it's an indented code block
        const isLikelyIndented = startsWithSpaces || hasIndentedPosition || hasIndentedPatterns;
        
        console.log("remarkMarkIndentedCode: Analyzing potential indented code:", {
          startsWithSpaces,
          hasIndentedPosition,
          hasIndentedPatterns,
          isLikelyIndented,
          startLine: node.position?.start.line,
          startColumn: node.position?.start.column
        });
        
        if (isLikelyIndented) {
          // Initialize data object if it doesn't exist
          node.data = node.data || {};
          // Set the flag needed by disableIndentedCode
          node.data.fences = false;
          
          indentedCodeBlocks++;
          console.log("remarkMarkIndentedCode: Marked as indented code block:", {
            firstLine: node.value ? node.value.split('\n')[0] : "",
            data: node.data
          });
        }
      }
    });
    
    console.log(`remarkMarkIndentedCode summary: Found ${codeBlocksFound} code blocks, marked ${indentedCodeBlocks} as indented`);
  };
} 