import {Plugin} from "unified"
import {Literal, Parent} from "mdast"
import {visit} from "unist-util-visit"

/**
 * A remark plugin that disables "indented code blocks".
 * We'll look for code nodes whose 'data' suggests they came from indentation,
 * then convert them to plain paragraphs or something similar.
 */
export const disableIndentedCode: Plugin<[], any> = function disableIndentedCode() {
  console.log("disableIndentedCode plugin initialized");
  
  return function transform(tree, file) {
    console.log("disableIndentedCode transform running on tree:", tree.type);
    
    let codeBlocksFound = 0;
    let indentedCodeBlocks = 0;
    
    visit(tree, "code", (node, index, parent) => {
      codeBlocksFound++;
      console.log("Found code block:", {
        value: node.value ? node.value.substring(0, 30) + "..." : "no value",
        data: node.data,
        lang: node.lang,
        meta: node.meta,
        position: node.position
      });
      
      if (!node.data) {
        console.log("No data property on code node");
        return;
      }
      if (typeof index === 'undefined' || !parent) {
        console.log("No index or parent for code node");
        return;
      }

      // Heuristic: if "data.indent" or "data._indent" or something indicates an indented code block:
      // Some versions set node.data.fences === false for an indented block.
      // Or node.data.meta === 'indent' depending on your remark/parse version.
      const isIndented = node.data?.fences === false
        || node.data?.meta === "indent"
        || node.data?.blankIndented === true
        // add more conditions if needed
        ;

      console.log("Is node indented?", isIndented, "based on data:", node.data);
      
      if (isIndented) {
        console.log("SUCCESS: Found a properly marked indented code block!");
      }

      if (isIndented && Array.isArray(parent.children)) {
        indentedCodeBlocks++;
        console.log("Converting indented code block to paragraph with content:", node.value?.substring(0, 30) + "...");
        
        // We'll turn this node into a paragraph node containing the code text.
        const paragraphNode = {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: node.value as string
            }
          ]
        }

        parent.children[index] = paragraphNode as any;
        console.log("Replacement completed");
      }
    });
    
    console.log(`disableIndentedCode summary: Found ${codeBlocksFound} code blocks, converted ${indentedCodeBlocks} indented blocks to paragraphs`);
  }
} 