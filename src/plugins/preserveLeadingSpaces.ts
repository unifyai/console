import {Plugin} from "unified"
import {Root, Paragraph, Heading, Text} from "mdast"
import {visit} from "unist-util-visit"

/**
 * A remark plugin that tries to preserve leading spaces in paragraph/heading text nodes,
 * by converting them into non-breaking spaces.
 */
export const preserveLeadingSpaces: Plugin<[], Root> = function preserveLeadingSpaces() {
  return function transform(tree, file) {
    visit(tree, (node) => {
      // We'll check for paragraph or heading nodes
      if (node.type === "paragraph" || node.type === "heading") {
        // Each paragraph/heading has children that might have "text" nodes.
        if (Array.isArray(node.children)) {
          node.children.forEach((child) => {
            if (child.type === "text") {
              const textNode = child as Text
              // Let's do a regex to find leading spaces
              const match = /^(\s+)/.exec(textNode.value)
              if (match) {
                const leadingSpaces = match[1]
                // Convert each space to NBSP:
                const replaced = leadingSpaces.replace(/ /g, "\u00A0")
                // Or if we want tabs to remain, we can do .replace(/\t/g, "\u00A0\u00A0"?)
                textNode.value = replaced + textNode.value.slice(leadingSpaces.length)
              }
            }
          })
        }
      }
    })
  }
} 