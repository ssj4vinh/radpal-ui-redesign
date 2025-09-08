// Function to extract section headers from a template
export function extractSectionHeaders(template: string): string[] {
  // Match section headers that end with a colon
  // Common patterns: FINDINGS:, IMPRESSION:, TECHNIQUE:, etc.
  const headerRegex = /^([A-Z][A-Z\s/]+):/gm
  const headers: string[] = []
  
  let match
  while ((match = headerRegex.exec(template)) !== null) {
    headers.push(match[1] + ':')
  }
  
  return headers
}

// Function to validate that all required headers are present in generated report
export function validateSectionHeaders(
  template: string, 
  generatedReport: string
): { valid: boolean; missing: string[]; extra: string[] } {
  const templateHeaders = extractSectionHeaders(template)
  const reportHeaders = extractSectionHeaders(generatedReport)
  
  // Find missing headers
  const missing = templateHeaders.filter(header => 
    !reportHeaders.includes(header)
  )
  
  // Find extra headers (not in template)
  const extra = reportHeaders.filter(header => 
    !templateHeaders.includes(header)
  )
  
  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra
  }
}

// Function to ensure section headers are preserved in report
export function ensureSectionHeaders(
  template: string,
  generatedReport: string
): string {
  const validation = validateSectionHeaders(template, generatedReport)
  
  if (validation.valid) {
    return generatedReport
  }
  
  console.warn('⚠️ Section header validation failed:', validation)
  
  // Extract template structure
  const templateHeaders = extractSectionHeaders(template)
  const templateLines = template.split('\n')
  
  // Try to fix the report by ensuring all headers are present
  let fixedReport = generatedReport
  
  // Add missing headers
  for (const missingHeader of validation.missing) {
    // Find where this header should be in the template
    const templateIndex = templateLines.findIndex(line => 
      line.trim().startsWith(missingHeader)
    )
    
    if (templateIndex !== -1) {
      // Get the template content for this section
      const templateContent = getTemplateSectionContent(template, missingHeader)
      
      // Try to find appropriate place to insert
      const insertPosition = findInsertPosition(fixedReport, templateHeaders, missingHeader)
      
      if (insertPosition !== -1) {
        // Insert the missing header with placeholder content
        const beforeInsert = fixedReport.substring(0, insertPosition)
        const afterInsert = fixedReport.substring(insertPosition)
        fixedReport = beforeInsert + '\n\n' + missingHeader + ' ' + templateContent + afterInsert
      }
    }
  }
  
  return fixedReport
}

// Helper function to get content after a section header in template
function getTemplateSectionContent(template: string, header: string): string {
  const lines = template.split('\n')
  const headerIndex = lines.findIndex(line => line.trim().startsWith(header))
  
  if (headerIndex === -1 || headerIndex === lines.length - 1) {
    return '[Section content]'
  }
  
  // Get the template content for this section (first line after header)
  const contentLine = lines[headerIndex + 1].trim()
  return contentLine || '[Section content]'
}

// Helper function to find where to insert a missing header
function findInsertPosition(
  report: string, 
  templateHeaders: string[], 
  missingHeader: string
): number {
  const missingIndex = templateHeaders.indexOf(missingHeader)
  
  if (missingIndex === -1) return -1
  
  // Find the next header that exists in the report
  for (let i = missingIndex + 1; i < templateHeaders.length; i++) {
    const nextHeader = templateHeaders[i]
    const nextHeaderPos = report.indexOf('\n' + nextHeader)
    if (nextHeaderPos !== -1) {
      return nextHeaderPos
    }
  }
  
  // If no subsequent header found, append at end
  return report.length
}