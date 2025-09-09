// Mock agent functions for UI development

export async function generateReport(
  findings: string,
  studyType: string,
  userId: string,
  model?: string
): Promise<{
  report: string;
  inputTokens: number;
  outputTokens: number;
  prompt?: string;
}> {
  // Return mock report
  return {
    report: `FINDINGS:\n${findings}\n\nIMPRESSION:\nMock generated impression for ${studyType} study.`,
    inputTokens: 100,
    outputTokens: 50,
    prompt: 'Mock prompt for UI development'
  };
}

export async function generateImpression(
  findings: string,
  studyType: string,
  userId: string,
  model?: string
): Promise<{
  impression: string;
  inputTokens: number;
  outputTokens: number;
  prompt?: string;
}> {
  // Return mock impression
  return {
    impression: `Mock generated impression based on the findings for ${studyType} study.`,
    inputTokens: 50,
    outputTokens: 25,
    prompt: 'Mock prompt for UI development'
  };
}

export default {
  generateReport,
  generateImpression
};