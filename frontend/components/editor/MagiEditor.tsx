"use client";

/**
 * MagiEditor.tsx
 *
 * The core editor component. Wraps TipTap's EditorContent with:
 *  - Toolbar
 *  - Word/character count footer
 *  - Streaming generation integration
 *  - Export to JSON (for debugging / handoff)
 *
 * Intentionally dumb about generation logic — that lives in useStreamGeneration.
 * This component only cares about rendering and user interaction.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import { forwardRef, useImperativeHandle, useEffect } from "react";
import { EditorToolbar } from "./EditorToolbar";
import { editorConfig } from "./editorConfig";
import { Editor } from "@tiptap/react";

export interface MagiEditorRef {
  editor: Editor | null;
}

interface MagiEditorProps {
  onEditorReady?: (editor: Editor) => void;
  isGenerating?: boolean;
}

export const MagiEditor = forwardRef<MagiEditorRef, MagiEditorProps>(
  ({ onEditorReady, isGenerating }, ref) => {
    const editor = useEditor({
      ...editorConfig,
      immediatelyRender: false,
    });

    // Expose editor instance to parent via ref
    useImperativeHandle(ref, () => ({ editor }), [editor]);

    // Notify parent when editor mounts
    useEffect(() => {
      if (editor) onEditorReady?.(editor);
    }, [editor, onEditorReady]);

    const wordCount = editor?.storage.characterCount?.words?.() ?? 0;
    const charCount = editor?.storage.characterCount?.characters?.() ?? 0;

    return (
      <div className="flex flex-col h-full bg-zinc-950">
        {/* Toolbar */}
        <EditorToolbar editor={editor} />

        {/* Editor surface */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Generating pulse overlay */}
          {isGenerating && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span className="text-xs text-amber-400 font-medium tracking-wide">
                Generating
              </span>
            </div>
          )}

          <div className="max-w-3xl mx-auto px-8 py-8">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between px-6 py-2 border-t border-white/5 bg-zinc-900/40">
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>
          <button
            onClick={() => {
              if (!editor) return;
              const json = JSON.stringify(editor.getJSON(), null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "document.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Export JSON
          </button>
        </div>
      </div>
    );
  }
);

MagiEditor.displayName = "MagiEditor";
