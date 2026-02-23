import { Plugin } from 'unified';
import { Literal, Parent } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * A remark plugin that disables "indented code blocks".
 * We'll look for code nodes whose 'data' suggests they came from indentation,
 * then convert them to plain paragraphs or something similar.
 */
export const disableIndentedCode: Plugin<[], any> = function disableIndentedCode() {
  return function transform(tree, file) {
    let codeBlocksFound = 0;
    let indentedCodeBlocks = 0;

    visit(tree, 'code', (node, index, parent) => {
      codeBlocksFound++;

      if (!node.data) {
        return;
      }
      if (typeof index === 'undefined' || !parent) {
        return;
      }

      // Heuristic: if "data.indent" or "data._indent" or something indicates an indented code block:
      // Some versions set node.data.fences === false for an indented block.
      // Or node.data.meta === 'indent' depending on your remark/parse version.
      const isIndented =
        node.data?.fences === false ||
        node.data?.meta === 'indent' ||
        node.data?.blankIndented === true;
      // add more conditions if needed
      if (isIndented && Array.isArray(parent.children)) {
        indentedCodeBlocks++;

        // We'll turn this node into a paragraph node containing the code text.
        const paragraphNode = {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: node.value as string,
            },
          ],
        };

        parent.children[index] = paragraphNode as any;
      }
    });
  };
};
