"use client";

/**
 * page.tsx — Root page
 *
 * Wires together:
 *  - MagiEditor (TipTap)
 *  - AISidebar (prompt UI)
 *  - useStreamGeneration (generation state)
 *
 * The editor ref pattern is used so the hook can access the editor instance
 * without React re-renders caused by prop drilling. The editor is accessed
 * directly via ref when needed for generation.
 */

import { useRef, useState, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { MagiEditor, MagiEditorRef } from "../components/editor/MagiEditor";
import { AISidebar } from "../components/sidebar/AISidebar";
import { Header } from "../components/ui/Header";
import { SelectionContext, useStreamGeneration } from "../lib/useStreamGeneration";
import { ContentType } from "../types/index";

export default function Home() {
  const editorRef = useRef<MagiEditorRef>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [selection, setSelection] = useState<SelectionContext | null>(null);

  const { status, error, nodeCount, generate, stop, reset } =
    useStreamGeneration(editorInstance);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);

    editor.on("selectionUpdate", () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, " ");
        setSelection({ from, to, text });
      } else {
        setSelection(null);
      }
    });
  }, []);

  const handleGenerate = async (
    prompt: string,
    contentType: ContentType,
    referenceContext?: string
  ) => {
    await generate(prompt, contentType, selection ?? undefined, referenceContext);
  };

  const handleReset = () => {
    reset();
    editorInstance?.commands.clearContent();
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <Header />
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
        <main className="flex-1 overflow-hidden min-h-0">
          <MagiEditor
            ref={editorRef}
            onEditorReady={handleEditorReady}
            isGenerating={status === "generating"}
          />
        </main>
        <AISidebar
          status={status}
          error={error}
          nodeCount={nodeCount}
          selectedText={selection?.text || undefined}
          onGenerate={handleGenerate}
          onStop={stop}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
