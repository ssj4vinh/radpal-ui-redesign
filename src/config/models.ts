export interface ModelConfig {
  // llama.cpp OpenAI-compatible server
  LLAMACPP_OPENAI_BASE: string;
  LLAMACPP_MODEL: string; // informational; the server serves this
}

export function getConfig(): ModelConfig {
  return {
    LLAMACPP_OPENAI_BASE: process.env.LLAMACPP_OPENAI_BASE || 'http://127.0.0.1:8080/v1',
    LLAMACPP_MODEL: process.env.LLAMACPP_MODEL || 'mistral-7b-instruct-q4_k_m.gguf'
  };
}