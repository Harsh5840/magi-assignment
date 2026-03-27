/**
 * editorConfig.ts
 *
 * Single source of truth for the TipTap editor configuration.
 * All extensions are declared and configured here so:
 *   - Adding a new extension = one line change here
 *   - The editor component stays clean and focused on rendering
 */

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TwoColumnLayout, Column } from "./extensions/TwoColumnLayout";

export const editorExtensions = [
  StarterKit.configure({}),

  Placeholder.configure({
    placeholder:
      "Describe what you want to create in the sidebar, or start typing here...",
  }),

  CharacterCount,

  Highlight.configure({
    multicolor: true,
  }),

  Image.configure({
    inline: false,
    allowBase64: false,
  }),

  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),

  TextStyle,

  TaskList,
  TaskItem.configure({
    nested: true,
  }),

  // Custom extensions
  TwoColumnLayout,
  Column,
];

export const editorConfig = {
  extensions: editorExtensions,
  editorProps: {
    attributes: {
      class:
        "prose prose-invert max-w-none focus:outline-none min-h-[60vh] px-2 py-4",
    },
  },
};
