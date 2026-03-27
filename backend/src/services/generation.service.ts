import { sanitizeDocument } from "../lib/tiptap-builder";
import { ContentType, TipTapDocument, TipTapNode } from "../types/index";
import { PromptFactory } from "./prompt/prompt-factory";
import { LLMProvider } from "./providers/llm-provider";
import { JsonlNodeParser } from "./streaming/jsonl-node-parser";

export class GenerationService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly promptFactory: PromptFactory
  ) {}

  async generateDocument(
    userInput: string,
    contentType: ContentType,
    selectedText?: string,
    referenceContext?: string
  ): Promise<TipTapDocument> {
    const raw = await this.provider.generateJson({
      contentType,
      systemPrompt: this.promptFactory.createSystemPrompt(contentType, false),
      userPrompt: this.promptFactory.createUserPrompt(
        userInput,
        contentType,
        selectedText,
        referenceContext
      ),
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("LLM returned non-JSON content");
    }

    const doc = sanitizeDocument(parsed);
    if (!doc) throw new Error("LLM returned an invalid TipTap document");
    return doc;
  }

  async streamDocument(
    userInput: string,
    contentType: ContentType,
    selectedText: string | undefined,
    referenceContext: string | undefined,
    onNode: (node: TipTapNode) => void
  ): Promise<void> {
    const parser = new JsonlNodeParser();
    const startedAt = Date.now();
    let chunkCount = 0;
    let emittedNodes = 0;

    console.log(
      `[stream] start contentType=${contentType} selected=${Boolean(selectedText)}`
    );

    const stream = this.provider.streamText({
      contentType,
      systemPrompt: this.promptFactory.createSystemPrompt(contentType, true),
      userPrompt: this.promptFactory.createUserPrompt(
        userInput,
        contentType,
        selectedText,
        referenceContext
      ),
    });

    for await (const chunk of stream) {
      chunkCount += 1;
      const nodes = parser.push(chunk);
      if (nodes.length > 0) {
        console.log(
          `[stream] chunk=${chunkCount} parsedNodes=${nodes.length} elapsedMs=${Date.now() - startedAt}`
        );
      }
      for (const node of nodes) {
        emittedNodes += 1;
        onNode(node);
      }
    }

    const trailingNodes = parser.flush();
    if (trailingNodes.length > 0) {
      console.log(
        `[stream] trailingNodes=${trailingNodes.length} elapsedMs=${Date.now() - startedAt}`
      );
    }
    for (const node of trailingNodes) {
      emittedNodes += 1;
      onNode(node);
    }

    console.log(
      `[stream] done chunks=${chunkCount} emittedNodes=${emittedNodes} totalMs=${Date.now() - startedAt}`
    );
  }
}
