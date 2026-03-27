/**
 * generate.route.ts
 *
 * Two endpoints:
 *
 *  POST /api/generate
 *    Full (non-streaming) generation. Returns a complete TipTap JSON document.
 *    Use this for smaller content types (social posts) where streaming adds
 *    complexity without meaningful perceived performance benefit.
 *
 *  POST /api/generate/stream
 *    Server-Sent Events (SSE) endpoint for progressive rendering.
 *    Emits StreamEvent objects as the AI generates each node.
 *    Use this for blog posts and landing pages.
 *
 * Why SSE over WebSockets?
 *   SSE is unidirectional (server → client), which is all we need here.
 *   It's simpler to implement, works over HTTP/1.1, and has native browser
 *   support via EventSource. WebSockets make sense if we need bidirectional
 *   real-time communication (e.g., collaborative editing), which is out of scope.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { generateDocument, streamDocument } from "../services/openai.service";
import { StreamEvent } from "../types/index";

export const generateRouter = Router();

// ─── Request validation schema ────────────────────────────────────────────────

const GenerateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000),
  contentType: z.enum(["social_post", "blog_post", "landing_page"]),
  selectedText: z.string().optional(),
  referenceContext: z.string().max(20000).optional(),
});

// ─── POST /api/generate ───────────────────────────────────────────────────────

generateRouter.post("/", async (req: Request, res: Response) => {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { prompt, contentType, selectedText, referenceContext } = parsed.data;

  try {
    const document = await generateDocument(
      prompt,
      contentType,
      selectedText,
      referenceContext
    );
    res.json({ document });
  } catch (err) {
    console.error("[generate] Error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

// ─── POST /api/generate/stream ────────────────────────────────────────────────

generateRouter.post("/stream", async (req: Request, res: Response) => {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { prompt, contentType, selectedText, referenceContext } = parsed.data;
  console.log(
    `[sse] request contentType=${contentType} selected=${Boolean(selectedText)} promptChars=${prompt.length}`
  );

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering if proxied
  res.flushHeaders();

  const send = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Signal start
  send({ type: "start" });

  let closed = false;
  res.on("close", () => {
    closed = true;
    console.log("[sse] response closed");
  });

  res.on("finish", () => {
    console.log("[sse] response finished");
  });

  await streamDocument(
    prompt,
    contentType,
    selectedText,
    referenceContext,
    (node) => {
      if (!closed && !res.writableEnded) {
        console.log(`[sse] emit node type=${node.type}`);
        send({ type: "node_append", node });
      }
    },
    () => {
      if (!closed && !res.writableEnded) {
        console.log("[sse] emit done");
        send({ type: "done" });
        res.end();
      }
    },
    (err) => {
      if (!closed && !res.writableEnded) {
        console.error("[sse] emit error", err.message);
        send({ type: "error", message: err.message });
        res.end();
      }
    }
  );
});
