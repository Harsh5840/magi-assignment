import OpenAI from "openai";
import { GenerateParams, LLMProvider } from "./llm-provider";

const MODEL = "gpt-4o";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateJson(params: GenerateParams): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      temperature: params.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    return completion.choices[0]?.message?.content ?? "{}";
  }

  async *streamText(params: GenerateParams): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: MODEL,
      temperature: params.temperature ?? 0.7,
      stream: true,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) yield delta;
    }
  }
}
