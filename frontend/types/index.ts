// Shared types — mirroring the backend types for end-to-end type safety.
// In a monorepo setup (Turborepo/Nx) you'd share a single types package.
// Here we duplicate to keep the setup simple for reviewers.

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

export type ContentType = "social_post" | "blog_post" | "landing_page";

export type StreamEventType = "start" | "node_append" | "done" | "error";

export interface StreamEvent {
  type: StreamEventType;
  node?: TipTapNode;
  message?: string;
}

export interface GenerateRequest {
  prompt: string;
  contentType: ContentType;
  selectedText?: string;
  referenceContext?: string;
}
