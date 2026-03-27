// ─── TipTap document node types ───────────────────────────────────────────────

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapDocument {
  type: "doc";
  content: TipTapNode[];
}

// ─── API request/response types ───────────────────────────────────────────────

export type ContentType = "social_post" | "blog_post" | "landing_page";

export interface GenerateRequest {
  prompt: string;
  contentType: ContentType;
  /** Optional existing document for AI-assisted iteration */
  existingDocument?: TipTapDocument;
  /** Text the user has selected in the editor for targeted revision */
  selectedText?: string;
  /** Optional notes, research, or source material provided by the user */
  referenceContext?: string;
}

export interface GenerateResponse {
  document: TipTapDocument;
}

// ─── Streaming chunk types ─────────────────────────────────────────────────────

/**
 * Server-Sent Event payload streamed to the client.
 *
 * We stream the TipTap document node-by-node so the frontend can render
 * content progressively instead of waiting for the full generation.
 *
 * Flow:
 *   start → N × node_append → done | error
 */
export type StreamEventType = "start" | "node_append" | "done" | "error";

export interface StreamEvent {
  type: StreamEventType;
  /** Present on node_append — a fully valid TipTap node ready to render */
  node?: TipTapNode;
  /** Present on error */
  message?: string;
}
