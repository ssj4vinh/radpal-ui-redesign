// Mock defaultAgentLogic for UI development
// This replaces the actual agent logic that was removed for security

export function createDefaultAgentLogic(template: string, keywords: string[]) {
  // Return a mock agent logic structure
  return {
    version: '1.0',
    studyType: 'custom',
    template: template,
    keywords: keywords || [],
    rules: [],
    generatePrompt: `Generate an impression based on the findings.`,
    generateImpression: `Generate an impression for this ${template} study.`,
    showDiffView: false
  };
}

export default {
  createDefaultAgentLogic
};