import type { ModelProvider } from "./ModelProvider";
import { getConfig } from "../config/models";

export class MistralLocalOllamaProvider implements ModelProvider {
  name = "Mistral (Local - Ollama)";
  supportsStreaming = false;

  async health(): Promise<boolean> {
    const { OLLAMA_BASE, OLLAMA_MODEL } = getConfig();
    try {
      const r = await fetch(`${OLLAMA_BASE}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (!r.ok) return false;
      const data = await r.json();
      return !!data?.models?.some((m: any) => m?.name === OLLAMA_MODEL);
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
    const { OLLAMA_BASE, OLLAMA_MODEL } = getConfig();
    
    // Non-streaming generate endpoint
    const prompt = opts.system ? `${opts.system}\n\n${opts.prompt}` : opts.prompt;
    const body = {
      model: OLLAMA_MODEL,
      prompt,
      options: {
        temperature: opts.temperature ?? 0.25,
        top_p: opts.topP ?? 0.9,
        num_predict: opts.maxTokens ?? 1200,
        stop: opts.stop ?? [],
        // Low repetition penalty for better report generation
        repeat_penalty: 1.1,
        repeat_last_n: 64
      },
      stream: false
    };
    
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama error: ${res.status} ${res.statusText} - ${errorText}`);
    }
    
    const data = await res.json();
    const text = data?.response ?? "";
    
    if (!text) {
      throw new Error("Ollama returned empty content");
    }
    
    return text;
  }
}