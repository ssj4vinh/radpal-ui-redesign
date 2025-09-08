// Default agent logic configuration for new study types
export function createDefaultAgentLogic(studyType: string): Record<string, any> {
  return {
    version: "2.0",
    
    // Formatting preferences
    formatting: {
      preserve_template_punctuation: true,
      use_bullet_points: false,
      capitalize_sections: true,
      strict_section_headers: true
    },
    
    // Report generation rules
    report: {
      no_hallucinated_findings: true,
      preserve_section_structure: true,
      flexible_content: true,
      include_technique_section: false,
      include_comparison: false,
      expand_lesions: true,
      
      // Anatomic routing rules for consistent organization
      anatomic_routing_rules: {
        loose_bodies: "joints",
        bone_contusions: "ossea_or_bone_marrow",
        joint_effusions: "joint_space",
        group_pathology_by_type: true
      }
    },
    
    // Impression-specific configuration
    impression: {
      numerically_itemized: true,
      concise_summary: true,
      omit_minor_or_incidental_findings_unless_relevant: true,
      include_recommendations: true,
      differential_diagnosis: false,
      severity_classification: true,
      prioritize_by_urgency: true,
      first_item_should_address_clinical_concern: true,
      
      // Common exclusions for most study types
      exclude_by_default: [
        "small_joint_effusion",
        "small_joint_effusions",
        "trace_joint_effusion",
        "trace_bursitis",
        "mild_tendinosis",
        "minimal_degenerative_changes",
        "small_baker_cyst",
        "small_bakers_cyst",
        "small_baker's_cyst",
        "small_baker's_cysts",
        "mild_bone_marrow_edema",
        "minimal_synovitis",
        "trace_fluid"
      ],
      
      // Only mention muscle atrophy if moderate or severe
      mention_muscle_atrophy_if: "moderate_or_severe",
      
      // Combine related findings
      combine_compartments: true
    },
    
    // Clinical correlation preferences
    clinical: {
      correlate_with_symptoms: true,
      mention_clinical_significance: true,
      suggest_follow_up: true,
      include_acuity: true,
      management_implications: false
    },
    
    // Measurement handling
    measurements: {
      include_key_measurements_only: true,
      describe_change_from_prior: true
    },
    
    // Severity and urgency handling
    severity: {
      highlight_urgent_findings: true,
      use_standard_terminology: true
    },
    
    // Writing style preferences
    style: {
      definitive_statements: true,
      active_voice: true,
      professional_tone: true
    },
    
    // Anatomy-specific rules
    anatomy: {
      group_related_findings: true,
      mention_normal_variants: false
    },
    
    // Custom instructions based on study type
    custom_instructions: generateCustomInstructionsForStudyType(studyType)
  }
}

// Generate study-type specific instructions
function generateCustomInstructionsForStudyType(studyType: string): string[] {
  const instructions: string[] = []
  
  // Add general instructions for all study types
  instructions.push("Ensure all findings from the provided list are incorporated into appropriate sections")
  instructions.push("Use appropriate medical terminology and maintain clinical accuracy")
  
  const lowerStudyType = studyType.toLowerCase()
  
  // Add specific instructions based on study type
  if (lowerStudyType.includes('mri')) {
    instructions.push("Comment on signal characteristics when relevant (T1, T2, STIR)")
    instructions.push("Mention enhancement patterns if contrast was used")
  }
  
  if (lowerStudyType.includes('ct')) {
    instructions.push("Describe density characteristics (hypodense, isodense, hyperdense)")
    instructions.push("Comment on enhancement if contrast was administered")
  }
  
  if (lowerStudyType.includes('spine')) {
    instructions.push("Assess spinal alignment and comment on any malalignment")
    instructions.push("Evaluate central canal and neural foramina")
    instructions.push("Comment on disc height and signal intensity")
  }
  
  if (lowerStudyType.includes('joint') || lowerStudyType.includes('knee') || 
      lowerStudyType.includes('shoulder') || lowerStudyType.includes('hip') ||
      lowerStudyType.includes('ankle') || lowerStudyType.includes('wrist') ||
      lowerStudyType.includes('elbow')) {
    instructions.push("Evaluate joint alignment and articulation")
    instructions.push("Assess cartilage surfaces and comment on defects")
    instructions.push("Comment on joint effusion volume when present")
  }
  
  if (lowerStudyType.includes('abdomen') || lowerStudyType.includes('pelvis')) {
    instructions.push("Evaluate solid organs systematically")
    instructions.push("Comment on any collections or free fluid")
  }
  
  if (lowerStudyType.includes('chest') || lowerStudyType.includes('thoracic')) {
    instructions.push("Assess lung parenchyma and pleural spaces")
    instructions.push("Evaluate mediastinal structures")
  }
  
  if (lowerStudyType.includes('head') || lowerStudyType.includes('brain')) {
    instructions.push("Assess gray-white matter differentiation")
    instructions.push("Comment on ventricular size and midline shift")
  }
  
  return instructions
}

// Export a simplified version for direct use
export const defaultAgentLogic = createDefaultAgentLogic("Generic")