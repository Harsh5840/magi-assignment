/**
 * TwoColumnLayout.ts
 *
 * Custom TipTap node extension for a two-column layout.
 * TipTap's open-source package doesn't include a multi-column extension,
 * so we build one ourselves using ProseMirror's Node API.
 *
 * DOM structure rendered:
 *   <div class="two-column-layout">
 *     <div class="column column--left">  ...content... </div>
 *     <div class="column column--right"> ...content... </div>
 *   </div>
 *
 * The `column` child node is also registered as an extension so TipTap
 * knows how to parse and render it.
 */

import { Node, mergeAttributes } from "@tiptap/core";

// ─── Column (child node) ──────────────────────────────────────────────────────

export const Column = Node.create({
  name: "column",
  group: "column",
  content: "block+",
  isolating: true,

  addAttributes() {
    return {
      position: {
        default: "left",
        parseHTML: (el) => el.getAttribute("data-position"),
        renderHTML: (attrs) => ({ "data-position": attrs.position }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-position]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: `column column--${HTMLAttributes["data-position"]}`,
      }),
      0,
    ];
  },
});

// ─── TwoColumnLayout (parent node) ───────────────────────────────────────────

export const TwoColumnLayout = Node.create({
  name: "twoColumnLayout",

  // Block-level node that lives at the top level of the document
  group: "block",

  // Must contain exactly two column nodes
  content: "column column",

  isolating: true,

  parseHTML() {
    return [{ tag: "div.two-column-layout" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "two-column-layout" }),
      0,
    ];
  },

  // Allow drag-and-drop of the whole layout block
  draggable: true,
});
