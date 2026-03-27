import { ContentType, TipTapDocument, TipTapNode } from "../types/index";
import { GenerationService } from "./generation.service";
import { PromptFactory } from "./prompt/prompt-factory";
import { OpenAIProvider } from "./providers/openai.provider";

const createGenerationService = () => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new GenerationService(new OpenAIProvider(openaiApiKey), new PromptFactory());
};

// ─── Full (non-streaming) generation ──────────────────────────────────────────

export async function generateDocument(
  userInput: string,
  contentType: ContentType,
  selectedText?: string,
  referenceContext?: string
): Promise<TipTapDocument> {
  return createGenerationService().generateDocument(
    userInput,
    contentType,
    selectedText,
    referenceContext
  );
}

// ─── Streaming generation ──────────────────────────────────────────────────────
/**
 * Streams OpenAI output and emits complete TipTap nodes as soon as they can be
 * parsed from the accumulating JSON string.
 *
 * Strategy — "node-boundary streaming":
 *   We ask GPT-4o to emit the document's top-level content array one node at a
 *   time, each on its own line. We accumulate streamed text and attempt to parse
 *   each line as a JSON node the moment we see a newline. Valid nodes are emitted
 *   immediately; incomplete lines keep accumulating.
 *
 *   This gives us sub-second time-to-first-content without needing to implement
 *   a full streaming JSON parser (which is complex and fragile).
 *
 * @param userInput   - The user's prompt
 * @param contentType - The type of content to generate
 * @param onNode      - Called with each fully-parsed TipTap node
 * @param onDone      - Called when streaming is complete
 * @param onError     - Called if an error occurs
 */
export async function streamDocument(
  userInput: string,
  contentType: ContentType,
  selectedText: string | undefined,
  referenceContext: string | undefined,
  onNode: (node: TipTapNode) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  try {
    await createGenerationService().streamDocument(
      userInput,
      contentType,
      selectedText,
      referenceContext,
      onNode
    );

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
