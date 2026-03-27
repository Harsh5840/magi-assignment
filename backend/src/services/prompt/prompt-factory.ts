import { ContentType } from "../../types/index";
import { SYSTEM_PROMPTS, buildUserPrompt } from "../../lib/prompts";

export class PromptFactory {
  createSystemPrompt(contentType: ContentType, streaming: boolean): string {
    if (!streaming) return SYSTEM_PROMPTS[contentType];

    return `${SYSTEM_PROMPTS[contentType]}

STREAMING OUTPUT CONTRACT:
- Preferred format: output a single TipTap doc wrapper and stream items inside "content" incrementally:
  {"type":"doc","content":[ ...nodes... ]}
- Emit complete node objects in the content array as soon as they are ready.
- Do NOT output markdown fences, comments, or prose.
- Keep each node JSON valid and schema-compliant.
- Optional fallback format: <node>{...node json...}</node> per node.
Example preferred format:
{"type":"doc","content":[
{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Title"}]},
{"type":"paragraph","content":[{"type":"text","text":"Body paragraph"}]}
]}`;
  }

  createUserPrompt(
    userInput: string,
    contentType: ContentType,
    selectedText?: string,
    referenceContext?: string
  ): string {
    return buildUserPrompt(userInput, contentType, selectedText, referenceContext);
  }
}
