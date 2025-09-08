export interface ModelProvider {
  name: string;
  supportsStreaming: boolean;
  generate(opts: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stop?: string[];
  }): Promise<string>;
}