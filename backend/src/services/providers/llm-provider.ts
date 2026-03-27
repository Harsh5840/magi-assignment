import { ContentType } from "../../types/index";

export interface GenerateParams {
  contentType: ContentType;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface LLMProvider {
  generateJson(params: GenerateParams): Promise<string>;
  streamText(params: GenerateParams): AsyncIterable<string>;
}
