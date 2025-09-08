/**
 * Maps RadPal UI model selection to callModel function parameters
 */
export function mapRadPalModelToAgent(apiProvider: string): string {
  switch (apiProvider) {
    case 'openai':
      return 'gpt-4'
    case 'gpt-o3-pro':
      return 'gpt-o3-pro'
    case 'gpt-4.1-mini':
      return 'gpt-4.1-mini'
    case 'gpt-5-mini':
      return 'gpt-5-mini'
    case 'gpt-5':
      return 'gpt-5'
    case 'claude-sonnet':
      return 'claude-3-sonnet'
    case 'claude-opus':
      return 'claude-3-opus'
    case 'claude-opus-4.1':
      return 'claude-opus-4.1'
    case 'gemini':
      return 'gemini-2.5-flash'
    case 'kimi':
      return 'kimi-k2-0711-preview'
    case 'mistral-local':
      return 'mistral-local'
    default:
      return 'gpt-4' // Default fallback
  }
}

/**
 * Example usage in RadPal components:
 * 
 * const { apiProvider } = useContext(AppContext)
 * const model = mapRadPalModelToAgent(apiProvider)
 * 
 * const report = await generateReport({
 *   userId: user.id,
 *   studyType: selectedStudyType,
 *   findings: findings,
 *   model: model
 * })
 */