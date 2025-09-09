// Mock model mapping for UI development

export function mapRadPalModelToAgent(model: string): string {
  // Mock mapping - returns the same model name
  const mappings: Record<string, string> = {
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
    'claude-3-opus': 'claude-3-opus',
    'claude-3-sonnet': 'claude-3-sonnet',
    'claude-3-haiku': 'claude-3-haiku'
  };
  
  return mappings[model] || model;
}

export default {
  mapRadPalModelToAgent
};