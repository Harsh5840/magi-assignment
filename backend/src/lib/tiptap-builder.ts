/**
 * tiptap-builder.ts
 *
 * Thin helpers for constructing valid TipTap document nodes programmatically.
 * Keeping node construction centralised here means:
 *   - prompts stay clean (just describe structure, not JSON schemas)
 *   - we have one place to validate/fix malformed AI output
 *   - swapping TipTap extensions only requires changes here
 */

import { TipTapDocument, TipTapNode, TipTapMark } from "../types/index";

// ─── Leaf nodes ───────────────────────────────────────────────────────────────

export const text = (content: string, marks: TipTapMark[] = []): TipTapNode => ({
  type: "text",
  text: content,
  ...(marks.length ? { marks } : {}),
});

export const boldMark = (): TipTapMark => ({ type: "bold" });
export const italicMark = (): TipTapMark => ({ type: "italic" });
export const linkMark = (href: string): TipTapMark => ({
  type: "link",
  attrs: { href, target: "_blank" },
});

// ─── Block nodes ──────────────────────────────────────────────────────────────

export const paragraph = (children: TipTapNode[]): TipTapNode => ({
  type: "paragraph",
  content: children,
});

export const heading = (
  level: 1 | 2 | 3 | 4,
  children: TipTapNode[]
): TipTapNode => ({
  type: "heading",
  attrs: { level },
  content: children,
});

export const bulletList = (items: TipTapNode[][]): TipTapNode => ({
  type: "bulletList",
  content: items.map((children) => ({
    type: "listItem",
    content: [paragraph(children)],
  })),
});

export const orderedList = (items: TipTapNode[][]): TipTapNode => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((children) => ({
    type: "listItem",
    content: [paragraph(children)],
  })),
});

export const blockquote = (children: TipTapNode[]): TipTapNode => ({
  type: "blockquote",
  content: [paragraph(children)],
});

export const horizontalRule = (): TipTapNode => ({ type: "horizontalRule" });

export const hardBreak = (): TipTapNode => ({ type: "hardBreak" });

export const image = (src: string, alt = "", title = ""): TipTapNode => ({
  type: "image",
  attrs: { src, alt, title },
});

export const codeBlock = (code: string, language = ""): TipTapNode => ({
  type: "codeBlock",
  attrs: { language },
  content: [text(code)],
});

// ─── Custom layout node ───────────────────────────────────────────────────────
/**
 * Two-column layout — not in TipTap OSS, so we represent it as a custom node.
 * The frontend renders this via a custom TipTap Node extension.
 */
export const twoColumnLayout = (
  leftChildren: TipTapNode[],
  rightChildren: TipTapNode[]
): TipTapNode => ({
  type: "twoColumnLayout",
  content: [
    { type: "column", attrs: { position: "left" }, content: leftChildren },
    { type: "column", attrs: { position: "right" }, content: rightChildren },
  ],
});

// ─── Document wrapper ─────────────────────────────────────────────────────────

export const doc = (content: TipTapNode[]): TipTapDocument => ({
  type: "doc",
  content,
});

// ─── Validation / sanitisation ────────────────────────────────────────────────

/**
 * Recursively walk an AI-generated node tree and strip anything that doesn't
 * look like a valid TipTap node. Better to drop a node than crash the editor.
 */
export function sanitizeNode(node: unknown): TipTapNode | null {
  if (typeof node !== "object" || node === null) return null;
  const n = node as Record<string, unknown>;
  if (typeof n.type !== "string") return null;

  const sanitized: TipTapNode = { type: n.type };

  if (n.attrs && typeof n.attrs === "object") {
    sanitized.attrs = n.attrs as Record<string, unknown>;
  }

  if (n.text && typeof n.text === "string") {
    sanitized.text = n.text;
  }

  if (Array.isArray(n.marks)) {
    sanitized.marks = (n.marks as unknown[])
      .filter((m): m is TipTapMark => typeof (m as TipTapMark).type === "string");
  }

  if (Array.isArray(n.content)) {
    sanitized.content = (n.content as unknown[])
      .map(sanitizeNode)
      .filter((c): c is TipTapNode => c !== null);
  }

  return sanitized;
}

export function sanitizeDocument(raw: unknown): TipTapDocument | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== "doc" || !Array.isArray(r.content)) return null;

  return {
    type: "doc",
    content: (r.content as unknown[])
      .map(sanitizeNode)
      .filter((n): n is TipTapNode => n !== null),
  };
}
