/**
 * api.ts
 *
 * Centralised API client for the Magi backend.
 * All fetch calls live here — components never call fetch() directly.
 *
 * Swapping the backend URL, adding auth headers, or changing
 * the base path only requires changes in this one file.
 */

import {
  ContentType,
  StreamEvent,
  TipTapDocument,
  TipTapNode,
} from "../types/index";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Full generation (non-streaming) ─────────────────────────────────────────

export async function generateContent(
  prompt: string,
  contentType: ContentType,
  selectedText?: string,
  referenceContext?: string
): Promise<TipTapDocument> {
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, contentType, selectedText, referenceContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.document as TipTapDocument;
}

// ─── Streaming generation ─────────────────────────────────────────────────────

export interface StreamCallbacks {
  onStart?: () => void;
  onNode: (node: TipTapNode) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Opens an SSE connection to /api/generate/stream.
 * Returns an AbortController so callers can cancel mid-stream.
 */
export function streamContent(
  prompt: string,
  contentType: ContentType,
  selectedText: string | undefined,
  referenceContext: string | undefined,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();
  const startedAt = Date.now();

  console.log("[stream-client] open", { contentType, promptChars: prompt.length });

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, contentType, selectedText, referenceContext }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const json = (await res.json()) as { error?: unknown };
          if (typeof json.error === "string") {
            message = json.error;
          } else if (json.error) {
            message = JSON.stringify(json.error);
          }
        } catch {
          const text = await res.text().catch(() => "Unknown error");
          if (text) message = text;
        }
        callbacks.onError?.(message);
        console.error("[stream-client] http error", message);
        return;
      }

      if (!res.body) {
        callbacks.onError?.("Empty stream body");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;

          const payload = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
            .trim();

          if (!payload) continue;

          try {
            const event: StreamEvent = JSON.parse(payload);
            console.log("[stream-client] event", event.type, {
              elapsedMs: Date.now() - startedAt,
            });

            switch (event.type) {
              case "start":
                callbacks.onStart?.();
                break;
              case "node_append":
                if (event.node) callbacks.onNode(event.node);
                break;
              case "done":
                callbacks.onDone?.();
                break;
              case "error":
                callbacks.onError?.(event.message ?? "Stream error");
                break;
            }
          } catch {
            // Ignore malformed event payload and continue reading stream.
          }
        }
      }

      // Flush any trailing complete frame after reader ends.
      if (buffer.trim()) {
        const payload = buffer
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n")
          .trim();

        if (payload) {
          try {
            const event: StreamEvent = JSON.parse(payload);
            console.log("[stream-client] trailing event", event.type, {
              elapsedMs: Date.now() - startedAt,
            });
            if (event.type === "node_append" && event.node) callbacks.onNode(event.node);
            if (event.type === "done") callbacks.onDone?.();
            if (event.type === "error") {
              callbacks.onError?.(event.message ?? "Stream error");
            }
          } catch {
            // Ignore malformed trailing payload.
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.log("[stream-client] aborted", {
          elapsedMs: Date.now() - startedAt,
        });
        callbacks.onDone?.();
      } else {
        console.error("[stream-client] exception", (err as Error).message);
        callbacks.onError?.((err as Error).message);
      }
    }
  })();

  return controller;
}
