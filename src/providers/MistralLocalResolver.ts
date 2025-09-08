import { MistralLocalLlamaCppProvider } from "./MistralLocalLlamaCppProvider";
import type { ModelProvider } from "./ModelProvider";

export async function resolveMistralLocal(): Promise<ModelProvider> {
  const llama = new MistralLocalLlamaCppProvider();
  
  // Check if llama.cpp server is running
  if (await llama.health()) {
    return llama;
  }
  
  // Provide detailed error message for setup
  throw new Error(
    "llama.cpp server is not running.\n\n" +
    "To start the local AI server:\n" +
    "1. Ensure you have a Mistral model in ./models/ directory\n" +
    "2. Run: npm run llama:serve\n\n" +
    "The server must be running for local AI to work."
  );
}