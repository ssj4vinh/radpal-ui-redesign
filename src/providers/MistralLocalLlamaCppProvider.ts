import type { ModelProvider } from "./ModelProvider";
import { getConfig } from "../config/models";

export class MistralLocalLlamaCppProvider implements ModelProvider {
  name = "Mistral (Local - llama.cpp)";
  supportsStreaming = false;

  async health(): Promise<boolean> {
    const { LLAMACPP_OPENAI_BASE } = getConfig();
    try {
      const r = await fetch(`${LLAMACPP_OPENAI_BASE}/models`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return r.ok;
    } catch { 
      return false; 
    }
  }

  async generate(opts: { 
    system?: string; 
    prompt: string; 
    maxTokens?: number; 
    temperature?: number; 
    topP?: number; 
    stop?: string[] 
  }): Promise<string> {
    const { LLAMACPP_OPENAI_BASE } = getConfig();
    const body = {
      model: "local-llamacpp", // server ignores/uses served model
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt }
      ],
      temperature: opts.temperature ?? 0.25,
      top_p: opts.topP ?? 0.9,
      max_tokens: opts.maxTokens ?? 1200,
      stop: opts.stop ?? [],
      // Low repetition penalty for better report generation
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    };
    
    const res = await fetch(`${LLAMACPP_OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`llama.cpp error: ${res.status} ${res.statusText} - ${errorText}`);
    }
    
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    
    if (!text) {
      throw new Error("llama.cpp returned empty content");
    }
    
    return text;
  }
}