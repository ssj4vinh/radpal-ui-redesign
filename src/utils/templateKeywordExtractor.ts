/**
 * Template Keyword Extractor
 * Extracts relevant medical keywords from user templates to improve study type suggestions
 */

interface ExtractedKeywords {
  anatomicalTerms: string[]
  pathologyTerms: string[]
  procedureTerms: string[]
  allTerms: string[]
}

/**
 * Extract medical keywords from a template string
 */
export function extractKeywordsFromTemplate(template: string): ExtractedKeywords {
  if (!template || typeof template !== 'string') {
    return {
      anatomicalTerms: [],
      pathologyTerms: [],
      procedureTerms: [],
      allTerms: []
    }
  }

  const lowerTemplate = template.toLowerCase()
  
  // Common words to exclude (stop words and common radiology report structure words)
  const stopWords = new Set([
    'the', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'doing', 'will', 'would', 'should', 'could', 'ought', 'may', 'might',
    'must', 'can', 'a', 'an', 'and', 'or', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
    'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off',
    'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'findings', 'impression', 'technique',
    'indication', 'comparison', 'patient', 'examination', 'study', 'image', 'images', 'exam',
    'within', 'normal', 'limits', 'demonstrates', 'shows', 'reveals', 'visualized', 'seen',
    'noted', 'identified', 'appears', 'evident', 'present', 'absent', 'without', 'evidence'
  ])

  // Extract anatomical terms (common anatomical structures in radiology)
  const anatomicalPatterns = [
    // Joints
    /\b(joint|articulation|synovia|capsule)\b/gi,
    // Bones
    /\b(bone|osseous|cortex|cortical|trabecular|medullary|metaphys|diaphys|epiphys|periost)\b/gi,
    // Ligaments
    /\b(ligament|tendon|fascia|retinaculum|aponeurosis)\b/gi,
    // Muscles
    /\b(muscle|muscular|myotend)\b/gi,
    // Cartilage
    /\b(cartilage|chondral|meniscus|meniscal|labrum|labral)\b/gi,
    // Specific anatomical regions
    /\b(femur|femoral|tibia|tibial|fibula|fibular|patella|patellar)\b/gi,
    /\b(humerus|humeral|radius|radial|ulna|ulnar|scaphoid|lunate)\b/gi,
    /\b(talus|talar|calcaneus|calcaneal|navicular|cuboid|cuneiform)\b/gi,
    /\b(acetabulum|acetabular|glenoid|glenohumeral|acromion|acromial)\b/gi,
    /\b(vertebra|vertebral|disc|discal|spinal|spine|facet)\b/gi,
    /\b(ankle|knee|hip|shoulder|elbow|wrist|foot|hand)\b/gi,
    /\b(anterior|posterior|medial|lateral|superior|inferior|proximal|distal)\b/gi
  ]

  // Extract pathology terms
  const pathologyPatterns = [
    /\b(tear|rupture|sprain|strain|injury|trauma|fracture|dislocation)\b/gi,
    /\b(edema|effusion|fluid|collection|hematoma|hemorrhage)\b/gi,
    /\b(degenerat|arthrosis|arthritis|chondromalacia|osteophyte|spur)\b/gi,
    /\b(inflammation|inflammat|synovitis|bursitis|tendinitis|tendinosis|tendinopathy)\b/gi,
    /\b(impingement|instability|laxity|subluxation|maltracking)\b/gi,
    /\b(lesion|mass|tumor|cyst|ganglion|neuroma)\b/gi,
    /\b(osteochondr|avascular|necrosis|infarct|ischemi)\b/gi,
    /\b(atrophy|hypertrophy|contracture|adhesion|fibrosis|scar)\b/gi
  ]

  // Extract procedure-related terms
  const procedurePatterns = [
    /\b(mri|magnetic resonance|mr imaging)\b/gi,
    /\b(ct|computed tomography|cat scan)\b/gi,
    /\b(x-ray|radiograph|plain film)\b/gi,
    /\b(ultrasound|sonograph|us|doppler)\b/gi,
    /\b(arthrogram|arthrography)\b/gi,
    /\b(contrast|gadolinium|enhancement)\b/gi,
    /\b(sagittal|coronal|axial|oblique)\b/gi,
    /\b(t1|t2|stir|pd|dwi|adc|flair|gre|gradient echo)\b/gi
  ]

  const anatomicalTerms = new Set<string>()
  const pathologyTerms = new Set<string>()
  const procedureTerms = new Set<string>()

  // Extract anatomical terms
  anatomicalPatterns.forEach(pattern => {
    const matches = lowerTemplate.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const term = match.trim().toLowerCase()
        if (term.length > 2 && !stopWords.has(term)) {
          anatomicalTerms.add(term)
        }
      })
    }
  })

  // Extract pathology terms
  pathologyPatterns.forEach(pattern => {
    const matches = lowerTemplate.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const term = match.trim().toLowerCase()
        if (term.length > 2 && !stopWords.has(term)) {
          pathologyTerms.add(term)
        }
      })
    }
  })

  // Extract procedure terms
  procedurePatterns.forEach(pattern => {
    const matches = lowerTemplate.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const term = match.trim().toLowerCase()
        if (term.length > 2 && !stopWords.has(term)) {
          procedureTerms.add(term)
        }
      })
    }
  })

  // Also extract multi-word medical phrases
  const multiWordPatterns = [
    /\b(anterior cruciate ligament|posterior cruciate ligament)\b/gi,
    /\b(medial collateral ligament|lateral collateral ligament)\b/gi,
    /\b(rotator cuff|frozen shoulder|tennis elbow|golfer elbow)\b/gi,
    /\b(meniscal tear|labral tear|ligament tear|tendon tear)\b/gi,
    /\b(joint effusion|bone marrow edema|stress fracture)\b/gi,
    /\b(plantar fascia|achilles tendon|patellar tendon)\b/gi,
    /\b(carpal tunnel|cubital tunnel|tarsal tunnel)\b/gi,
    /\b(baker cyst|ganglion cyst|synovial cyst)\b/gi
  ]

  multiWordPatterns.forEach(pattern => {
    const matches = lowerTemplate.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const term = match.trim().toLowerCase()
        // Classify multi-word terms
        if (term.includes('ligament') || term.includes('tendon') || term.includes('fascia')) {
          anatomicalTerms.add(term)
        } else if (term.includes('tear') || term.includes('cyst') || term.includes('edema') || 
                   term.includes('fracture') || term.includes('syndrome')) {
          pathologyTerms.add(term)
        } else {
          anatomicalTerms.add(term)
        }
      })
    }
  })

  // Combine all terms
  const allTerms = new Set([...anatomicalTerms, ...pathologyTerms, ...procedureTerms])

  return {
    anatomicalTerms: Array.from(anatomicalTerms),
    pathologyTerms: Array.from(pathologyTerms),
    procedureTerms: Array.from(procedureTerms),
    allTerms: Array.from(allTerms)
  }
}

/**
 * Extract keywords from all templates and organize by study type
 */
export function extractKeywordsFromAllTemplates(
  templates: Record<string, any>
): Record<string, string[]> {
  const keywordsByStudyType: Record<string, string[]> = {}
  
  Object.entries(templates).forEach(([studyType, templateData]) => {
    if (templateData && templateData.template) {
      const keywords = extractKeywordsFromTemplate(templateData.template)
      // Use all terms but prioritize anatomical terms
      keywordsByStudyType[studyType] = [
        ...keywords.anatomicalTerms,
        ...keywords.pathologyTerms
      ]
    }
  })
  
  return keywordsByStudyType
}

/**
 * Calculate similarity score between findings text and study type keywords
 */
export function calculateSimilarityScore(
  findingsText: string,
  keywords: string[]
): number {
  if (!findingsText || !keywords || keywords.length === 0) {
    return 0
  }
  
  const lowerFindings = findingsText.toLowerCase()
  let score = 0
  let matchedKeywords = 0
  
  keywords.forEach(keyword => {
    if (lowerFindings.includes(keyword)) {
      matchedKeywords++
      // Give higher weight to longer, more specific terms
      const weight = keyword.split(' ').length // Multi-word terms get higher weight
      score += weight
      
      // Bonus for exact word matches (not just substring)
      const wordBoundaryPattern = new RegExp(`\\b${keyword}\\b`, 'i')
      if (wordBoundaryPattern.test(findingsText)) {
        score += 0.5
      }
    }
  })
  
  // Normalize score by number of keywords (to not favor templates with many keywords)
  const normalizedScore = keywords.length > 0 ? score / Math.sqrt(keywords.length) : 0
  
  // Add small bonus for matching multiple keywords
  if (matchedKeywords > 1) {
    return normalizedScore * (1 + matchedKeywords * 0.1)
  }
  
  return normalizedScore
}