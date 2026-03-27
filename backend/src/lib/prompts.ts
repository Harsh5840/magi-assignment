/**
 * prompts.ts
 *
 * System and user prompt templates for each content type.
 *
 * Design principle: prompts are the AI "contract". Changing a prompt is as
 * impactful as changing application code, so they live here — versioned,
 * named, and easy to iterate without touching generation logic.
 */

import { ContentType } from "../types/index";

// ─── Shared TipTap schema description (injected into every system prompt) ─────

const TIPTAP_SCHEMA = `
You output ONLY valid JSON — a TipTap document object. No markdown fences, no prose.

TipTap document schema:
{
  "type": "doc",
  "content": [ ...nodes ]
}

Available node types and their required shape:
- paragraph:       { type: "paragraph", content: [textNodes] }
- heading:         { type: "heading", attrs: { level: 1|2|3|4 }, content: [textNodes] }
- bulletList:      { type: "bulletList", content: [listItems] }
- orderedList:     { type: "orderedList", attrs: { start: 1 }, content: [listItems] }
- listItem:        { type: "listItem", content: [paragraph] }
- blockquote:      { type: "blockquote", content: [paragraph] }
- horizontalRule:  { type: "horizontalRule" }
- image:           { type: "image", attrs: { src: string, alt: string } }
- codeBlock:       { type: "codeBlock", attrs: { language: string }, content: [textNode] }
- twoColumnLayout: { type: "twoColumnLayout", content: [leftColumn, rightColumn] }
- column:          { type: "column", attrs: { position: "left"|"right" }, content: [nodes] }

Text node:
{ "type": "text", "text": "...", "marks": [] }

Available marks: bold, italic, underline, link ({ type: "link", attrs: { href, target } })

Rules:
- Every leaf must be a text node with a "text" property.
- Do not invent node types outside the list above.
- Use twoColumnLayout for image+text side-by-side sections.
- Emit only the raw JSON object — nothing else.
`.trim();

// ─── System prompts ───────────────────────────────────────────────────────────

const BASE_SYSTEM = `You are an expert content writer and document architect for Magi, an AI-native marketing platform. ${TIPTAP_SCHEMA}`;

export const SYSTEM_PROMPTS: Record<ContentType, string> = {
  social_post: `${BASE_SYSTEM}

Content type: LinkedIn / social post.
Guidelines:
- Keep it punchy and engaging — 150–300 words max.
- Open with a hook (question, bold statement, or statistic).
- Use short paragraphs (1–3 sentences each).
- End with a clear call-to-action or thought-provoking question.
- Structure: hook paragraph → 2-4 body paragraphs → closing paragraph.
- Do NOT use headings — social posts are flowing prose.`,

  blog_post: `${BASE_SYSTEM}

Content type: Long-form blog post.
Guidelines:
- Target 600–1200 words of substantive content.
- Start with an H1 title.
- Use H2 subheadings to break up sections (3–5 sections minimum).
- Include at least one blockquote, one ordered or bullet list, and one image placeholder (use a descriptive Unsplash URL like https://source.unsplash.com/800x400/?[topic]).
- Use twoColumnLayout for at least one section where an image sits beside text.
- End with a conclusion section.`,

  landing_page: `${BASE_SYSTEM}

Content type: Marketing landing page.
Guidelines:
- Structure: Hero → Value Props (use twoColumnLayout) → Features → Social Proof → CTA.
- Hero must have an H1 headline, subheadline paragraph, and an image.
- Value props: use a twoColumnLayout with icon descriptions in each column.
- Features: use a bulletList or orderedList.
- Social proof: use a blockquote.
- CTA: bold call-to-action paragraph.
- Use horizontalRule to separate major sections.
- Include image placeholders (Unsplash URLs).`,
};

// ─── User prompt builders ──────────────────────────────────────────────────────

export function buildUserPrompt(
  userInput: string,
  contentType: ContentType,
  selectedText?: string,
  referenceContext?: string
): string {
  const referenceBlock = referenceContext?.trim()
    ? `
Reference material (use as factual/contextual grounding):
"""
${referenceContext.trim()}
"""
`
    : "";

  if (selectedText) {
    return `
The user wants to revise a specific section of an existing document.

Selected text to revise:
"""
${selectedText}
"""

User instruction:
"""
${userInput}
"""

${referenceBlock}

Rewrite ONLY the selected section and return it as a complete TipTap document
(type: "doc") containing just the revised nodes. The caller will splice this
back into the full document.
`.trim();
  }

  const typeLabel =
    contentType === "social_post"
      ? "LinkedIn/social post"
      : contentType === "blog_post"
      ? "blog post"
      : "landing page";

  return `Create a ${typeLabel} about the following:

"""
${userInput}
"""

${referenceBlock}

Return only the TipTap JSON document.`;
}
