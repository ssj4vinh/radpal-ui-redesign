// Example agent logic configuration for strict section headers with fluid content

export const strictHeaderAgentLogic = {
  version: "2.1",
  formatting: {
    preserve_template_punctuation: true,
    capitalize_sections: true,
    strict_section_headers: true  // New flag for strict header enforcement
  },
  report: {
    no_hallucinated_findings: true,
    preserve_section_structure: true,  // Ensures all template sections are preserved
    flexible_content: true  // Allows natural, flowing content within sections
  },
  examples: [
    {
      context: "Example showing strict headers with fluid content",
      input: "Template:\nFINDINGS:\nBones: [describe bone findings]\nSoft tissues: [describe soft tissue findings]\n\nIMPRESSION:\n[summary of findings]",
      output: "FINDINGS:\nBones: The osseous structures demonstrate no acute fractures or destructive lesions. Mild degenerative changes are noted at the L4-L5 level with minimal anterior osteophyte formation.\nSoft tissues: The paraspinal soft tissues appear unremarkable. No abnormal fluid collections or mass lesions are identified.\n\nIMPRESSION:\nNo acute osseous abnormality. Mild degenerative changes at L4-L5."
    }
  ],
  custom_instructions: [
    "Maintain the exact section headers from the template - do not add subsections or modify header text",
    "Write naturally flowing content within each section based on the findings",
    "Ensure every section from the template appears in the final report, even if findings are normal"
  ]
}