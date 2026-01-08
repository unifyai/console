import { Plugin } from 'unified';
import { Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * A remark plugin that adds explicit <br/> elements for every newline in text nodes.
 * This is more aggressive than remarkBreaks, ensuring maximum whitespace preservation.
 */
export const forceLineBreaks: Plugin<[], Root> = function forceLineBreaks() {
  return function transform(tree, file) {
    visit(tree, 'text', (node) => {
      const textNode = node as Text;

      // If the text node contains newlines, add explicit break tags
      if (textNode.value.includes('\n')) {
        // Split the text by newlines and create an array of nodes
        // alternating between text and break nodes
        const parts = textNode.value.split('\n');

        // Early return if no newlines found
        if (parts.length <= 1) return;

        // Build the replacement nodes
        const newNodes = [];
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] !== '') {
            newNodes.push({
              type: 'text',
              value: parts[i],
            });
          }

          // Add a break node after each part except the last one
          if (i < parts.length - 1) {
            newNodes.push({
              type: 'break',
            });
          }
        }

        // Replace the original node with our new array of nodes
        Object.assign(textNode, {
          type: 'paragraph',
          children: newNodes,
          value: undefined,
        });
      }
    });
  };
};
