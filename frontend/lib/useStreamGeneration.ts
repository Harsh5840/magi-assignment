/**
 * useStreamGeneration.ts
 *
 * React hook that manages the full lifecycle of a streaming generation request.
 *
 * State machine:
 *   idle → generating → done
 *                    ↘ error
 *
 * The hook appends nodes to the editor in real-time as they arrive from the
 * SSE stream. The editor reference is passed in (not managed here) so this
 * hook stays decoupled from TipTap internals.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import { streamContent, generateContent } from "../lib/api";
import { ContentType, TipTapNode } from "../types/index";

export type GenerationStatus = "idle" | "generating" | "done" | "error";

export interface SelectionContext {
  from: number;
  to: number;
  text: string;
}

export interface UseStreamGenerationReturn {
  status: GenerationStatus;
  error: string | null;
  nodeCount: number;
  generate: (
    prompt: string,
    contentType: ContentType,
    selection?: SelectionContext,
    referenceContext?: string
  ) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useStreamGeneration(
  editor: Editor | null
): UseStreamGenerationReturn {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<TipTapNode[]>([]);
  const processingRef = useRef(false);
  const streamFinishedRef = useRef(false);
  const insertedCountRef = useRef(0);

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const countNodeTextChars = (node: TipTapNode): number => {
    let count = 0;

    const walk = (n: TipTapNode) => {
      if (typeof n.text === "string") count += n.text.length;
      if (Array.isArray(n.content)) {
        for (const child of n.content) walk(child);
      }
    };

    walk(node);
    return count;
  };

  const revealNodeByChars = (node: TipTapNode, charsToReveal: number): TipTapNode => {
    let remaining = charsToReveal;

    const walk = (n: TipTapNode): TipTapNode | null => {
      if (typeof n.text === "string") {
        if (remaining <= 0) return null;
        const part = n.text.slice(0, remaining);
        remaining -= part.length;
        if (!part) return null;
        return { ...n, text: part };
      }

      const out: TipTapNode = { ...n };

      if (Array.isArray(n.content)) {
        const revealedChildren = n.content
          .map((child) => walk(child))
          .filter((child): child is TipTapNode => child !== null);

        if (revealedChildren.length > 0) {
          out.content = revealedChildren;
        } else {
          delete out.content;
        }
      }

      return out;
    };

    return walk(node) ?? { ...node };
  };

  const insertNodeNow = (node: TipTapNode) => {
    if (!editor) return;
    const endPos = editor.state.doc.nodeSize - 2;
    editor.chain().insertContentAt(endPos, node as never).run();
  };

  const getLastTopLevelNodeRange = (): { from: number; to: number } | null => {
    if (!editor) return null;

    const { doc } = editor.state;
    if (doc.childCount === 0) return null;

    let from = 0;
    for (let i = 0; i < doc.childCount - 1; i += 1) {
      from += doc.child(i).nodeSize;
    }

    const last = doc.child(doc.childCount - 1);
    return { from, to: from + last.nodeSize };
  };

  const animateNodeInsert = async (node: TipTapNode) => {
    if (!editor) return;

    const totalChars = countNodeTextChars(node);
    if (totalChars <= 1) {
      insertNodeNow(node);
      return;
    }

    const appendAt = editor.state.doc.nodeSize - 2;
    const firstFrame = revealNodeByChars(node, 1);
    editor.chain().insertContentAt(appendAt, firstFrame as never).run();

    const delayMs = totalChars > 300 ? 4 : 10;

    for (let i = 2; i <= totalChars; i += 1) {
      const range = getLastTopLevelNodeRange();
      if (!range) break;

      const nextFrame = revealNodeByChars(node, i);
      editor.chain().insertContentAt(range, nextFrame as never).run();

      // Keep the UI feeling "typing-like" while avoiding excessive lag.
      await sleep(delayMs);
    }
  };

  const maybeCompleteStream = () => {
    if (
      streamFinishedRef.current &&
      !processingRef.current &&
      queueRef.current.length === 0
    ) {
      abortRef.current = null;
      console.log("[stream-hook] stream done", { count: insertedCountRef.current });
      setStatus("done");
    }
  };

  const processQueue = async () => {
    if (!editor || processingRef.current) return;

    processingRef.current = true;

    try {
      while (queueRef.current.length > 0) {
        const node = queueRef.current.shift();
        if (!node) continue;

        try {
          await animateNodeInsert(node);
          insertedCountRef.current += 1;
          setNodeCount(insertedCountRef.current);
          console.log("[stream-hook] node inserted", {
            nodeType: node.type,
            count: insertedCountRef.current,
          });
        } catch (err) {
          console.warn("[stream] failed to insert node", node?.type, err);
        }
      }
    } finally {
      processingRef.current = false;
      maybeCompleteStream();
    }
  };

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    queueRef.current = [];
    streamFinishedRef.current = true;
    insertedCountRef.current = 0;
    setError(null);
    setStatus("done");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setNodeCount(0);
  }, []);

  const generate = useCallback(
    async (
      prompt: string,
      contentType: ContentType,
      selection?: SelectionContext,
      referenceContext?: string
    ) => {
      if (!editor) return;

      console.log("[stream-hook] generate", {
        contentType,
        hasSelection: Boolean(selection?.text.trim()),
      });

      abortRef.current?.abort();
      abortRef.current = null;
      queueRef.current = [];
      processingRef.current = false;
      streamFinishedRef.current = false;
      insertedCountRef.current = 0;

      setStatus("generating");
      setError(null);
      setNodeCount(0);

      if (selection?.text.trim()) {
        try {
          const partialDoc = await generateContent(
            prompt,
            contentType,
            selection.text,
            referenceContext
          );

          editor
            .chain()
            .insertContentAt(
              { from: selection.from, to: selection.to },
              partialDoc.content as never
            )
            .run();

          setNodeCount(partialDoc.content.length);
          console.log("[stream-hook] selection rewrite done", {
            nodes: partialDoc.content.length,
          });
          setStatus("done");
        } catch (err) {
          console.error("[stream-hook] selection rewrite error", err);
          setError((err as Error).message);
          setStatus("error");
        }

        return;
      }

      // Clear the editor before generating
      editor.commands.clearContent();

      // Stream all full-document generations node-by-node.
      streamFinishedRef.current = false;
      insertedCountRef.current = 0;

      abortRef.current = streamContent(
        prompt,
        contentType,
        undefined,
        referenceContext,
        {
        onStart: () => {
          console.log("[stream-hook] stream started");
        },

        onNode: (node: TipTapNode) => {
          queueRef.current.push(node);
          void processQueue();
        },

        onDone: () => {
          streamFinishedRef.current = true;
          maybeCompleteStream();
        },

        onError: (message: string) => {
          abortRef.current = null;
          queueRef.current = [];
          streamFinishedRef.current = true;
          console.error("[stream-hook] stream error", message);
          setError(message);
          setStatus("error");
        },
      }
      );
    },
    [editor]
  );

  return { status, error, nodeCount, generate, stop, reset };
}
